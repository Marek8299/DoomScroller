using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface IFfmpegService
{
    Task<VideoProbeResult> ProbeAsync(string filePath, CancellationToken ct = default);

    /// <summary>
    /// Transcodes <paramref name="sourceFilePath"/> into every rendition implied by
    /// <paramref name="options"/> (one per resolved resolution target), writing each
    /// output to <paramref name="outputDirectory"/> and reporting progress per rendition
    /// via <paramref name="onRenditionStarted"/>/<paramref name="onRenditionFinished"/>.
    /// When <paramref name="normalizeVolume"/> is set (and the source has audio) the audio is
    /// loudness-normalised and therefore always re-encoded, even if copy-audio is enabled.
    /// </summary>
    Task<List<VideoRendition>> ConvertAllRenditionsAsync(
        string sourceFilePath,
        VideoProbeResult sourceProbe,
        ConversionOptions options,
        string outputDirectory,
        bool normalizeVolume,
        Func<VideoRendition, Task>? onRenditionStarted = null,
        Func<VideoRendition, Task>? onRenditionFinished = null,
        CancellationToken ct = default);
}
