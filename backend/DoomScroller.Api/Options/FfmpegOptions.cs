namespace DoomScroller.Api.Options;

/// <summary>
/// Bound from the "Ffmpeg" section of appsettings.json (env: FFMPEG__FFMPEGPATH / FFMPEG__FFPROBEPATH).
/// Blank paths fall back to whatever `ffmpeg` / `ffprobe` resolve to on PATH.
/// </summary>
public class FfmpegOptions
{
    public string? FfmpegPath { get; set; }
    public string? FfprobePath { get; set; }

    public string ResolvedFfmpegPath => string.IsNullOrWhiteSpace(FfmpegPath) ? "ffmpeg" : FfmpegPath;
    public string ResolvedFfprobePath => string.IsNullOrWhiteSpace(FfprobePath) ? "ffprobe" : FfprobePath;
}
