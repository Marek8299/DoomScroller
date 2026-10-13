using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using DoomScroller.Api.Models;
using DoomScroller.Api.Options;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Services;

/// <summary>
/// Wraps the ffmpeg / ffprobe command line tools. Everything here shells out rather than
/// linking a native binding, so the only host requirement is that `ffmpeg`/`ffprobe` are
/// on PATH (see README for install notes, including hardware encoder drivers).
/// </summary>
public class FfmpegService : IFfmpegService
{
    private readonly ILogger<FfmpegService> _logger;
    private readonly string _ffmpegPath;
    private readonly string _ffprobePath;

    // Encoder availability barely changes at runtime, so we probe it once and cache it.
    private static readonly SemaphoreSlim EncoderDetectionLock = new(1, 1);
    private static HashSet<string>? _availableEncoders;

    public FfmpegService(ILogger<FfmpegService> logger, IOptions<FfmpegOptions> options)
    {
        _logger = logger;
        _ffmpegPath = options.Value.ResolvedFfmpegPath;
        _ffprobePath = options.Value.ResolvedFfprobePath;

        _logger.LogInformation("Using ffmpeg: {FfmpegPath}, ffprobe: {FfprobePath}", _ffmpegPath, _ffprobePath);
    }

    public async Task<VideoProbeResult> ProbeAsync(string filePath, CancellationToken ct = default)
    {
        var args = new List<string>
        {
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            filePath
        };

        var (exitCode, stdout, stderr) = await RunProcessAsync(_ffprobePath, args, ct);
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"ffprobe failed ({exitCode}) for '{filePath}': {stderr}");
        }

        using var doc = JsonDocument.Parse(stdout);
        var root = doc.RootElement;

        var result = new VideoProbeResult();

        if (root.TryGetProperty("format", out var format) &&
            format.TryGetProperty("duration", out var durationEl) &&
            double.TryParse(durationEl.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var duration))
        {
            result.DurationSeconds = duration;
        }

        if (root.TryGetProperty("streams", out var streams))
        {
            foreach (var stream in streams.EnumerateArray())
            {
                var codecType = stream.TryGetProperty("codec_type", out var ct2) ? ct2.GetString() : null;

                if (codecType == "video" && result.VideoCodec is null)
                {
                    result.VideoCodec = stream.TryGetProperty("codec_name", out var vc) ? vc.GetString() : null;
                    result.Width = stream.TryGetProperty("width", out var w) ? w.GetInt32() : 0;
                    result.Height = stream.TryGetProperty("height", out var h) ? h.GetInt32() : 0;
                }
                else if (codecType == "audio" && result.AudioCodec is null)
                {
                    result.AudioCodec = stream.TryGetProperty("codec_name", out var ac) ? ac.GetString() : null;
                }
            }
        }

        if (result.Width == 0 || result.Height == 0)
        {
            throw new InvalidOperationException($"Could not determine video dimensions for '{filePath}'.");
        }

        return result;
    }

    public async Task<List<VideoRendition>> ConvertAllRenditionsAsync(
        string sourceFilePath,
        VideoProbeResult sourceProbe,
        ConversionOptions options,
        string outputDirectory,
        bool normalizeVolume,
        Func<VideoRendition, Task>? onRenditionStarted = null,
        Func<VideoRendition, Task>? onRenditionFinished = null,
        CancellationToken ct = default)
    {
        Directory.CreateDirectory(outputDirectory);

        var availableEncoders = await DetectAvailableEncodersAsync(ct);
        var heights = options.ResolveResolutionHeights(sourceProbe.Height);
        // Normalising means filtering the audio, which rules out stream copy.
        var hasAudio = !string.IsNullOrWhiteSpace(sourceProbe.AudioCodec);
        var normalize = normalizeVolume && hasAudio;
        var copyAudio = !normalize && options.ForceCopyAudioIfSupported && ConversionOptions.CanCopyAudioCodec(sourceProbe.AudioCodec);

        // Measure once per video; every rendition then applies the same gain.
        string? audioFilter = null;
        if (normalize)
        {
            var measurement = await MeasureLoudnessAsync(sourceFilePath, ct);
            audioFilter = LoudnessNormalization.BuildFilter(measurement);
            _logger.LogInformation("Normalising volume with {Filter}", audioFilter);
        }

        var renditions = new List<VideoRendition>();

        foreach (var height in heights)
        {
            var rendition = new VideoRendition
            {
                Height = height,
                IsOriginalResolution = height == sourceProbe.Height,
                Container = options.Container,
                AudioCodec = copyAudio ? sourceProbe.AudioCodec! : hasAudio ? "aac" : string.Empty,
                AudioWasCopied = copyAudio,
                Status = RenditionStatus.Processing
            };

            var (videoCodecArgName, videoCodecLabel, usedHardware) = ResolveVideoEncoder(options.Preset, availableEncoders);
            rendition.VideoCodec = videoCodecLabel;
            rendition.UsedHardwareEncoder = usedHardware;

            rendition.FilePath = Path.Combine(outputDirectory, $"{rendition.Id}{options.Container.ToExtension()}");

            if (onRenditionStarted is not null)
            {
                await onRenditionStarted(rendition);
            }

            try
            {
                var args = BuildFfmpegArgs(
                    sourceFilePath,
                    rendition,
                    options,
                    sourceProbe,
                    videoCodecArgName,
                    copyAudio,
                    audioFilter);

                _logger.LogInformation("ffmpeg {Args}", string.Join(' ', args));

                var (exitCode, _, stderr) = await RunProcessAsync(_ffmpegPath, args, ct);
                if (exitCode != 0)
                {
                    throw new InvalidOperationException($"ffmpeg exited with code {exitCode}: {TailOf(stderr, 2000)}");
                }

                rendition.SizeBytes = new FileInfo(rendition.FilePath).Length;
                rendition.Status = RenditionStatus.Ready;
            }
            catch (Exception ex)
            {
                rendition.Status = RenditionStatus.Failed;
                rendition.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Failed to produce {Height}p rendition for {Source}", height, sourceFilePath);
            }

            renditions.Add(rendition);

            if (onRenditionFinished is not null)
            {
                await onRenditionFinished(rendition);
            }
        }

        return renditions;
    }

    /// <summary>
    /// Builds the codec + filter + container arguments for one rendition, per the
    /// encoding preset rules:
    ///   lowest size    -> AV1 (libsvtav1) video, AAC audio
    ///   conservative   -> HEVC video, hardware (NVENC/AMF) if present else libx265, AAC audio
    ///   web optimised  -> H.264 (libx264) video, AAC audio, faststart for streaming
    /// Audio is stream-copied instead of re-encoded to AAC when <paramref name="copyAudio"/> is true.
    /// </summary>
    private List<string> BuildFfmpegArgs(
        string sourceFilePath,
        VideoRendition rendition,
        ConversionOptions options,
        VideoProbeResult sourceProbe,
        string videoEncoder,
        bool copyAudio,
        string? audioFilter)
    {
        var args = new List<string> { "-y", "-i", sourceFilePath };

        // ---- Video filter: scale down to the target height, keep aspect ratio, never upscale ----
        if (!rendition.IsOriginalResolution)
        {
            // -2 keeps width even (required by yuv420p-based encoders) while preserving aspect ratio.
            args.AddRange(new[] { "-vf", $"scale=-2:{rendition.Height}" });
        }

        // ---- Video codec + quality knobs per preset ----
        args.AddRange(new[] { "-c:v", videoEncoder });

        switch (options.Preset)
        {
            case EncodingPreset.LowestSize:
                // libsvtav1: CRF-driven, favors small files over encode speed.
                args.AddRange(new[] { "-crf", "35", "-preset", "8", "-pix_fmt", "yuv420p" });
                break;

            case EncodingPreset.Conservative when videoEncoder == "hevc_nvenc":
                args.AddRange(new[] { "-preset", "p5", "-rc", "vbr", "-cq", "28", "-pix_fmt", "yuv420p" });
                break;

            case EncodingPreset.Conservative when videoEncoder == "hevc_amf":
                args.AddRange(new[] { "-quality", "balanced", "-rc", "cqp", "-qp_i", "26", "-qp_p", "28", "-pix_fmt", "yuv420p" });
                break;

            case EncodingPreset.Conservative: // libx265 software fallback
                args.AddRange(new[] { "-crf", "26", "-preset", "medium", "-pix_fmt", "yuv420p" });
                break;

            case EncodingPreset.WebOptimized:
                args.AddRange(new[] { "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p" });
                break;
        }

        // ---- Audio ----
        if (copyAudio)
        {
            args.AddRange(new[] { "-c:a", "copy" });
        }
        else
        {
            if (audioFilter is not null)
            {
                // loudnorm resamples internally to 192 kHz, which the AAC encoder can't take,
                // so pin the output rate.
                args.AddRange(new[] { "-af", audioFilter, "-ar", "48000" });
            }

            args.AddRange(new[] { "-c:a", "aac", "-b:a", "160k" });
        }

        // ---- Container-specific muxer flags ----
        if (options.Container == ContainerFormat.Mp4)
        {
            // Moves the moov atom to the front so browsers can start playback before the
            // whole file has downloaded - important for a feed the user scrolls through.
            args.AddRange(new[] { "-movflags", "+faststart" });
        }

        args.AddRange(new[] { "-f", options.Container.ToFfmpegMuxer() });
        args.Add(rendition.FilePath);

        return args;
    }

    private static (string encoderArg, string label, bool usedHardware) ResolveVideoEncoder(
        EncodingPreset preset, HashSet<string> availableEncoders)
    {
        return preset switch
        {
            EncodingPreset.LowestSize => ("libsvtav1", "av1", false),

            EncodingPreset.Conservative => availableEncoders.Contains("hevc_nvenc")
                ? ("hevc_nvenc", "hevc", true)
                : availableEncoders.Contains("hevc_amf")
                    ? ("hevc_amf", "hevc", true)
                    : ("libx265", "hevc", false),

            EncodingPreset.WebOptimized => ("libx264", "h264", false),

            _ => throw new ArgumentOutOfRangeException(nameof(preset))
        };
    }

    /// <summary>Analysis pass of the two-pass loudness normalisation; null if it fails or the audio is silent.</summary>
    private async Task<LoudnessMeasurement?> MeasureLoudnessAsync(string sourceFilePath, CancellationToken ct)
    {
        var args = new List<string>
        {
            "-hide_banner", "-nostats",
            "-i", sourceFilePath,
            "-vn",
            "-af", LoudnessNormalization.MeasureFilter,
            "-f", "null", "-"
        };

        var (exitCode, _, stderr) = await RunProcessAsync(_ffmpegPath, args, ct);
        if (exitCode != 0)
        {
            _logger.LogWarning("Loudness analysis failed ({ExitCode}); falling back to single-pass normalisation: {Stderr}",
                exitCode, TailOf(stderr, 500));
            return null;
        }

        return LoudnessNormalization.ParseMeasurement(stderr);
    }

    /// <summary>Runs `ffmpeg -encoders` once and caches which hardware encoders are actually built in.</summary>
    private async Task<HashSet<string>> DetectAvailableEncodersAsync(CancellationToken ct)
    {
        if (_availableEncoders is not null) return _availableEncoders;

        await EncoderDetectionLock.WaitAsync(ct);
        try
        {
            if (_availableEncoders is not null) return _availableEncoders;

            var (exitCode, stdout, _) = await RunProcessAsync(_ffmpegPath, new List<string> { "-hide_banner", "-encoders" }, ct);
            var found = new HashSet<string>();

            if (exitCode == 0)
            {
                foreach (var line in stdout.Split('\n'))
                {
                    if (line.Contains("hevc_nvenc")) found.Add("hevc_nvenc");
                    if (line.Contains("hevc_amf")) found.Add("hevc_amf");
                }
            }
            else
            {
                _logger.LogWarning("Could not list ffmpeg encoders; hardware HEVC encoding will be treated as unavailable.");
            }

            _availableEncoders = found;
            _logger.LogInformation("Hardware encoders detected: {Encoders}",
                found.Count == 0 ? "(none, will use libx265)" : string.Join(", ", found));
            return found;
        }
        finally
        {
            EncoderDetectionLock.Release();
        }
    }

    private static async Task<(int exitCode, string stdout, string stderr)> RunProcessAsync(
        string fileName, List<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        using var process = new Process { StartInfo = psi };

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) => { if (e.Data is not null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderr.AppendLine(e.Data); };

        try
        {
            process.Start();
        }
        catch (System.ComponentModel.Win32Exception ex)
        {
            throw new InvalidOperationException(
                $"Could not launch '{fileName}'. Make sure ffmpeg/ffprobe are installed and on PATH.", ex);
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync(ct);

        return (process.ExitCode, stdout.ToString(), stderr.ToString());
    }

    private static string TailOf(string text, int maxChars) =>
        text.Length <= maxChars ? text : text[^maxChars..];
}
