using System.Globalization;
using DoomScroller.Api.Options;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Services;

public interface IThumbnailService
{
    /// <summary>Grabs a preview frame from the source video; returns the saved file's name.</summary>
    Task<string> CreateAsync(Guid videoId, string sourceFilePath, double durationSeconds, CancellationToken ct = default);
}

public class ThumbnailService : IThumbnailService
{
    public const int Width = 360;

    private readonly StoragePaths _storage;
    private readonly FfmpegOptions _ffmpeg;

    public ThumbnailService(StoragePaths storage, IOptions<FfmpegOptions> ffmpeg)
    {
        _storage = storage;
        _ffmpeg = ffmpeg.Value;
    }

    public async Task<string> CreateAsync(Guid videoId, string sourceFilePath, double durationSeconds, CancellationToken ct = default)
    {
        Directory.CreateDirectory(_storage.Thumbs);
        var fileName = $"{videoId:N}.jpg";
        var output = Path.Combine(_storage.Thumbs, fileName);

        // A second in, to skip fade-ins and black first frames; earlier for very short clips.
        var seek = Math.Max(0, Math.Min(1.0, durationSeconds / 4));

        var (exit, _, stderr) = await ProcessRunner.RunAsync(_ffmpeg.ResolvedFfmpegPath,
        [
            "-v", "error", "-nostdin",
            "-ss", seek.ToString("F3", CultureInfo.InvariantCulture),
            "-i", sourceFilePath,
            "-frames:v", "1",
            "-vf", $"scale={Width}:-2",
            "-q:v", "4",
            "-y", output
        ], TimeSpan.FromSeconds(30), ct);

        if (exit != 0 || !File.Exists(output))
        {
            try { File.Delete(output); } catch (IOException) { }
            throw new InvalidOperationException($"Thumbnail extraction failed (exit {exit}): {stderr.Trim()}");
        }

        return fileName;
    }
}
