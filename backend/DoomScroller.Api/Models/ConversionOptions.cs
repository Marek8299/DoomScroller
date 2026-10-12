using System.Text.Json.Serialization;

namespace DoomScroller.Api.Models;

/// <summary>
/// Options submitted alongside an upload, matching the four configuration axes:
/// encoding preset, container, audio copy behaviour and resolution targets.
/// </summary>
public class ConversionOptions
{
    public EncodingPreset Preset { get; set; } = EncodingPreset.WebOptimized;

    public ContainerFormat Container { get; set; } = ContainerFormat.Mp4;

    /// <summary>
    /// When true, DoomScroller will stream-copy the source audio track instead of
    /// re-encoding it, but only if the source codec is aac, mp3 or opus. WMA audio
    /// is always re-encoded to AAC, copy or not.
    /// </summary>
    public bool ForceCopyAudioIfSupported { get; set; } = true;

    /// <summary>
    /// Either the literal string "original" (one rendition, source resolution),
    /// or a comma-separated list of target heights, e.g. "480,720,1080,2160".
    /// Any target taller than the source is dropped; the source is never upscaled.
    /// </summary>
    public string ResolutionTargets { get; set; } = "original";

    private static readonly HashSet<string> SupportedCopyAudioCodecs = new(StringComparer.OrdinalIgnoreCase)
    {
        "aac", "mp3", "opus"
    };

    public static bool CanCopyAudioCodec(string? sourceAudioCodec)
    {
        if (string.IsNullOrWhiteSpace(sourceAudioCodec)) return false;
        // wmav1/wmav2 (and anything else not explicitly allow-listed) is never copied.
        return SupportedCopyAudioCodecs.Contains(sourceAudioCodec);
    }

    /// <summary>
    /// Resolves the configured resolution targets against the probed source height.
    /// Returns a list of heights to render, in descending order. An empty/"original"
    /// config yields a single entry equal to the source height.
    /// </summary>
    public IReadOnlyList<int> ResolveResolutionHeights(int sourceHeight)
    {
        var raw = (ResolutionTargets ?? "original").Trim();

        if (raw.Length == 0 || raw.Equals("original", StringComparison.OrdinalIgnoreCase))
        {
            return new[] { sourceHeight };
        }

        var heights = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => int.TryParse(token, out var h) ? h : (int?)null)
            .Where(h => h.HasValue)
            .Select(h => h!.Value)
            .Where(h => h > 0 && h <= sourceHeight) // never upscale
            .Distinct()
            .OrderByDescending(h => h)
            .ToList();

        // If every requested target was larger than the source, fall back to source resolution
        // so the user still gets a rendition instead of an empty result.
        if (heights.Count == 0)
        {
            heights.Add(sourceHeight);
        }

        return heights;
    }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RenditionStatus
{
    Queued,
    Processing,
    Ready,
    Failed
}
