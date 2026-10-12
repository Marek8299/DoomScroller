namespace DoomScroller.Api.Models;

/// <summary>
/// The three transcoding profiles DoomScroller offers. Each preset pins a video codec;
/// audio is AAC unless <see cref="ConversionOptions.ForceCopyAudioIfSupported"/> allows a copy.
/// </summary>
public enum EncodingPreset
{
    /// <summary>AV1 video (libsvtav1). Smallest files, slowest to encode, needs a modern decoder to play back.</summary>
    LowestSize,

    /// <summary>HEVC video. Uses hardware (NVENC / AMD VCE) when the host exposes it, otherwise falls back to libx265.</summary>
    Conservative,

    /// <summary>H.264 video. Largest files but plays everywhere and starts up fast in a browser.</summary>
    WebOptimized
}
