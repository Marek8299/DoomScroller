namespace DoomScroller.Api.Models;

public enum ContainerFormat
{
    Mp4,
    Mkv
}

public static class ContainerFormatExtensions
{
    public static string ToExtension(this ContainerFormat container) => container switch
    {
        ContainerFormat.Mp4 => ".mp4",
        ContainerFormat.Mkv => ".mkv",
        _ => throw new ArgumentOutOfRangeException(nameof(container))
    };

    public static string ToFfmpegMuxer(this ContainerFormat container) => container switch
    {
        ContainerFormat.Mp4 => "mp4",
        ContainerFormat.Mkv => "matroska",
        _ => throw new ArgumentOutOfRangeException(nameof(container))
    };
}
