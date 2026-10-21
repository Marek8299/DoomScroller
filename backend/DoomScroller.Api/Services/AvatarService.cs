using DoomScroller.Api.Options;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Services;

/// <summary>The upload isn't an acceptable picture. The message is safe to show to the user.</summary>
public class InvalidImageException : Exception
{
    public InvalidImageException(string message) : base(message) { }
}

public interface IAvatarService
{
    /// <summary>Validates and converts an upload into a 256x256 JPEG in the avatars folder; returns its file name.</summary>
    Task<string> SaveAsync(Stream upload, CancellationToken ct = default);
}

/// <summary>
/// Turns an uploaded picture into a clean, square, 256x256 JPEG with no metadata (so no GPS
/// coordinates or camera details survive), using the ffmpeg we already depend on.
/// </summary>
public class AvatarService : IAvatarService
{
    public const long MaxUploadBytes = 5 * 1024 * 1024;
    private const int MaxSidePixels = 6000; // refuse absurdly large images before decoding them
    public const int OutputSize = 256;

    private readonly StoragePaths _storage;
    private readonly FfmpegOptions _ffmpeg;

    public AvatarService(StoragePaths storage, IOptions<FfmpegOptions> ffmpeg)
    {
        _storage = storage;
        _ffmpeg = ffmpeg.Value;
    }

    public async Task<string> SaveAsync(Stream upload, CancellationToken ct = default)
    {
        // 1. Is it really an image of a kind we accept? (Judged by content, not by name.)
        var header = new byte[ImageSignature.HeaderLength];
        var read = await ReadFullyAsync(upload, header, ct);
        var kind = ImageSignature.Detect(header.AsSpan(0, read))
            ?? throw new InvalidImageException("Please choose a JPEG, PNG or WebP image.");

        Directory.CreateDirectory(_storage.Temp);
        Directory.CreateDirectory(_storage.Avatars);
        var temp = Path.Combine(_storage.Temp, $"{Guid.NewGuid():N}{ImageSignature.Extension(kind)}");
        var fileName = $"{Guid.NewGuid():N}.jpg";
        var output = Path.Combine(_storage.Avatars, fileName);

        try
        {
            // 2. Copy to a scratch file, enforcing the size limit as the bytes arrive.
            await using (var file = File.Create(temp))
            {
                await file.WriteAsync(header.AsMemory(0, read), ct);
                var buffer = new byte[81920];
                long total = read;
                int n;
                while ((n = await upload.ReadAsync(buffer, ct)) > 0)
                {
                    total += n;
                    if (total > MaxUploadBytes) throw new InvalidImageException("That image is too large (5 MB maximum).");
                    await file.WriteAsync(buffer.AsMemory(0, n), ct);
                }
            }

            // 3. Check the dimensions from the header alone, before anything decodes the pixels.
            var (probeExit, probeOut, _) = await ProcessRunner.RunAsync(_ffmpeg.ResolvedFfprobePath,
                ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", temp],
                TimeSpan.FromSeconds(10), ct);
            var sides = probeOut.Trim().Split(',');
            if (probeExit != 0 || sides.Length < 2 || !int.TryParse(sides[0], out var w) || !int.TryParse(sides[1], out var h) || w < 1 || h < 1)
            {
                throw new InvalidImageException("That file couldn't be read as an image.");
            }
            if (w > MaxSidePixels || h > MaxSidePixels)
            {
                throw new InvalidImageException($"That image is too large ({MaxSidePixels} pixels per side maximum).");
            }

            // 4. Square crop from the centre, resize, drop all metadata. "-protocol_whitelist file" means
            //    even a crafted file can't make ffmpeg fetch anything from the network or other paths.
            var (exit, _, stderr) = await ProcessRunner.RunAsync(_ffmpeg.ResolvedFfmpegPath,
            [
                "-v", "error", "-nostdin", "-protocol_whitelist", "file",
                "-i", temp,
                "-frames:v", "1",
                "-vf", $"scale={OutputSize}:{OutputSize}:force_original_aspect_ratio=increase,crop={OutputSize}:{OutputSize}",
                "-map_metadata", "-1",
                "-q:v", "3",
                "-y", output
            ], TimeSpan.FromSeconds(20), ct);

            if (exit != 0 || !File.Exists(output))
            {
                throw new InvalidImageException("That file couldn't be processed as an image.");
            }

            return fileName;
        }
        catch
        {
            TryDelete(output); // don't leave a half-written picture behind
            throw;
        }
        finally
        {
            TryDelete(temp);
        }
    }

    private static async Task<int> ReadFullyAsync(Stream stream, byte[] buffer, CancellationToken ct)
    {
        var total = 0;
        while (total < buffer.Length)
        {
            var n = await stream.ReadAsync(buffer.AsMemory(total), ct);
            if (n == 0) break;
            total += n;
        }
        return total;
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}
