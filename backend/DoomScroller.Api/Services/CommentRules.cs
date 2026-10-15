using System.Text.RegularExpressions;

namespace DoomScroller.Api.Services;

/// <summary>What counts as an acceptable comment, in one testable place.</summary>
public static partial class CommentRules
{
    public const int MaxLength = 500;

    [GeneratedRegex("\n{3,}")]
    private static partial Regex BlankLineRun();

    /// <summary>
    /// Trims, unifies line endings and collapses runs of blank lines (so nobody can post a wall
    /// of empty lines). Returns the cleaned text, or an error message if it can't be posted.
    /// </summary>
    public static (string? Text, string? Error) Clean(string? raw)
    {
        var text = (raw ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Trim();
        text = BlankLineRun().Replace(text, "\n\n");

        if (text.Length == 0) return (null, "Comment can't be empty.");
        if (text.Length > MaxLength) return (null, $"Comment can be at most {MaxLength} characters.");
        return (text, null);
    }
}
