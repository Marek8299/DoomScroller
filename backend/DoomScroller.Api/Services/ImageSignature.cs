namespace DoomScroller.Api.Services;

public enum ImageKind { Jpeg, Png, WebP }

/// <summary>
/// Recognises the image formats we accept by their first bytes ("magic numbers"), not by the file
/// name or the Content-Type header, both of which the uploader controls and can lie about.
/// </summary>
public static class ImageSignature
{
    public const int HeaderLength = 12;

    public static ImageKind? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return ImageKind.Jpeg;

        ReadOnlySpan<byte> png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        if (header.Length >= png.Length && header[..png.Length].SequenceEqual(png)) return ImageKind.Png;

        // WebP is "RIFF", four size bytes, then "WEBP".
        if (header.Length >= 12 &&
            header[..4].SequenceEqual("RIFF"u8) &&
            header.Slice(8, 4).SequenceEqual("WEBP"u8)) return ImageKind.WebP;

        return null;
    }

    public static string Extension(ImageKind kind) => kind switch
    {
        ImageKind.Jpeg => ".jpg",
        ImageKind.Png => ".png",
        ImageKind.WebP => ".webp",
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };
}
