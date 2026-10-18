namespace DoomScroller.Api.Services;

/// <summary>Rules for a video's title and description, shared by upload and edit so they can't drift apart.</summary>
public static class VideoMetadataRules
{
    public const int MaxTitleLength = 200;
    public const int MaxDescriptionLength = 2000;

    /// <summary>
    /// Trims both. A blank title falls back to <paramref name="fallbackTitle"/> (the file name, on
    /// upload) or is an error when there's no fallback (on edit); a blank description becomes null.
    /// </summary>
    public static (string? Title, string? Description, string? Error) Clean(
        string? title, string? description, string? fallbackTitle = null)
    {
        var cleanTitle = string.IsNullOrWhiteSpace(title) ? fallbackTitle?.Trim() : title.Trim();
        if (string.IsNullOrEmpty(cleanTitle)) return (null, null, "Title can't be empty.");
        if (cleanTitle.Length > MaxTitleLength) return (null, null, $"Title can be at most {MaxTitleLength} characters.");

        var cleanDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        if (cleanDescription is { Length: > MaxDescriptionLength })
        {
            return (null, null, $"Description can be at most {MaxDescriptionLength} characters.");
        }

        return (cleanTitle, cleanDescription, null);
    }
}
