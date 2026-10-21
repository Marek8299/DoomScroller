namespace DoomScroller.Api.Contracts;

/// <summary>Public URLs for files the API serves statically. The folders are mapped in Program.cs.</summary>
public static class MediaUrls
{
    public static string? Avatar(string? fileName) => fileName is null ? null : $"/avatars/{fileName}";
    public static string? Thumbnail(string? fileName) => fileName is null ? null : $"/thumbs/{fileName}";
}
