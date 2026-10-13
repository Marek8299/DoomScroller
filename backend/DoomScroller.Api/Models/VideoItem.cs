using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DoomScroller.Api.Models;

public class VideoItem
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string OriginalFileName { get; init; } = string.Empty;
    public DateTimeOffset UploadedAtUtc { get; init; } = DateTimeOffset.UtcNow;
    public ConversionOptions Options { get; init; } = new();

    [JsonIgnore]
    public string SourceFilePath { get; init; } = string.Empty;

    public RenditionStatus Status { get; set; } = RenditionStatus.Queued;
    public string? ErrorMessage { get; set; }

    public VideoProbeResult? Probe { get; set; }

    /// <summary>
    /// Perceptual hash of the source video: 16 evenly spaced frames, each a 64-bit DCT pHash
    /// written as 16 hex chars (256 chars total). Survives re-encoding/resizing, unlike a file
    /// hash. Null until processing has run (or if hashing failed). Server-side only.
    /// </summary>
    [JsonIgnore]
    public string? PerceptualHash { get; set; }

    public List<VideoRendition> Renditions { get; init; } = new();
}

public class VideoRendition
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>Target height in pixels, or the source height when the target was "original".</summary>
    public int Height { get; set; }

    public bool IsOriginalResolution { get; set; }

    public ContainerFormat Container { get; set; }
    public string VideoCodec { get; set; } = string.Empty;
    public string AudioCodec { get; set; } = string.Empty;
    public bool AudioWasCopied { get; set; }
    public bool UsedHardwareEncoder { get; set; }

    [JsonIgnore]
    public string FilePath { get; set; } = string.Empty;

    [NotMapped]
    public string FileName => Path.GetFileName(FilePath);

    public long SizeBytes { get; set; }
    public RenditionStatus Status { get; set; } = RenditionStatus.Queued;
    public string? ErrorMessage { get; set; }

    /// <summary>Relative URL the frontend can stream this rendition from.</summary>
    [NotMapped]
    public string Url => $"/media/{Id}{Container.ToExtension()}";
}

public class VideoProbeResult
{
    public int Width { get; set; }
    public int Height { get; set; }
    public double DurationSeconds { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
}
