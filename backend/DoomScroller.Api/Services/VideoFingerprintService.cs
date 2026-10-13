using System.Diagnostics;
using System.Globalization;
using DoomScroller.Api.Options;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Services;

/// <summary>
/// Pulls evenly spaced frames out of a video with ffmpeg (as raw 32x32 grayscale) and feeds them
/// to <see cref="PerceptualHash"/>. Frames are sampled at fixed *fractions* of the duration, so a
/// re-encoded or resized copy of the same video samples the same moments.
/// </summary>
public class VideoFingerprintService : IVideoFingerprintService
{
    public const int SampleCount = 16;

    private readonly string _ffmpegPath;

    public VideoFingerprintService(IOptions<FfmpegOptions> ffmpegOptions)
    {
        _ffmpegPath = ffmpegOptions.Value.ResolvedFfmpegPath;
    }

    public async Task<string> ComputePerceptualHashAsync(string filePath, double durationSeconds, CancellationToken ct = default)
    {
        if (durationSeconds <= 0)
        {
            throw new InvalidOperationException("Cannot fingerprint a video with unknown duration.");
        }

        var frameHashes = new List<ulong>(SampleCount);
        for (var i = 0; i < SampleCount; i++)
        {
            // Middle of each of SampleCount equal slices - never exactly 0 or the very end.
            var timestamp = durationSeconds * (i + 0.5) / SampleCount;
            var frame = await ExtractGrayFrameAsync(filePath, timestamp, ct);
            frameHashes.Add(PerceptualHash.HashFrame(frame));
        }

        return PerceptualHash.ToHex(frameHashes);
    }

    private async Task<byte[]> ExtractGrayFrameAsync(string filePath, double seconds, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _ffmpegPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var arg in new[]
        {
            "-v", "error",
            "-ss", seconds.ToString("F3", CultureInfo.InvariantCulture), // before -i: fast keyframe seek
            "-i", filePath,
            "-frames:v", "1",
            // Squash to a square regardless of aspect ratio; 'area' averages pixels when shrinking.
            "-vf", $"scale={PerceptualHash.FrameSize}:{PerceptualHash.FrameSize}:flags=area,format=gray",
            "-f", "rawvideo",
            "-pix_fmt", "gray",
            "pipe:1"
        })
        {
            psi.ArgumentList.Add(arg);
        }

        using var process = new Process { StartInfo = psi };
        try
        {
            process.Start();
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            throw new InvalidOperationException(
                $"Could not launch '{_ffmpegPath}'. Make sure ffmpeg is installed or Ffmpeg:FfmpegPath is set.", ex);
        }

        try
        {
            var stderrTask = process.StandardError.ReadToEndAsync(ct);
            using var buffer = new MemoryStream(PerceptualHash.FrameBytes);
            await process.StandardOutput.BaseStream.CopyToAsync(buffer, ct);
            await process.WaitForExitAsync(ct);
            var stderr = await stderrTask;

            if (process.ExitCode != 0 || buffer.Length != PerceptualHash.FrameBytes)
            {
                throw new InvalidOperationException(
                    $"ffmpeg frame extraction at {seconds:F3}s failed (exit {process.ExitCode}, {buffer.Length} bytes): {stderr.Trim()}");
            }

            return buffer.ToArray();
        }
        finally
        {
            if (!process.HasExited)
            {
                try { process.Kill(entireProcessTree: true); } catch { /* already gone */ }
            }
        }
    }
}
