namespace DoomScroller.Api.Services;

public interface IVideoFingerprintService
{
    /// <summary>
    /// Computes the video's perceptual hash: <see cref="VideoFingerprintService.SampleCount"/> frames sampled
    /// evenly across the duration, each reduced to a 64-bit pHash, concatenated as hex.
    /// </summary>
    Task<string> ComputePerceptualHashAsync(string filePath, double durationSeconds, CancellationToken ct = default);
}
