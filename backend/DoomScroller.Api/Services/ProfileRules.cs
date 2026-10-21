using System.Text.RegularExpressions;

namespace DoomScroller.Api.Services;

public static partial class ProfileRules
{
    public const int MaxBioLength = 200;

    [GeneratedRegex("\n{3,}")]
    private static partial Regex BlankLineRun();

    /// <summary>Trims, unifies line endings, collapses runs of blank lines. Empty becomes null; too long is an error.</summary>
    public static (string? Bio, string? Error) CleanBio(string? raw)
    {
        var text = (raw ?? string.Empty).Replace("\r\n", "\n").Replace('\r', '\n').Trim();
        text = BlankLineRun().Replace(text, "\n\n");

        if (text.Length == 0) return (null, null);
        if (text.Length > MaxBioLength) return (null, $"Bio can be at most {MaxBioLength} characters.");
        return (text, null);
    }
}
