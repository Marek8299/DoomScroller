using System.Text.RegularExpressions;

namespace DoomScroller.Api.Auth;

/// <summary>Username/password rules, in one place so they're easy to find and test.</summary>
public static partial class CredentialRules
{
    public const int MinUsernameLength = 3;
    public const int MaxUsernameLength = 30;
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128; // also caps the cost of hashing absurdly long input

    [GeneratedRegex("^[A-Za-z0-9_]+$")]
    private static partial Regex UsernamePattern();

    public static string Normalize(string username) => username.Trim().ToLowerInvariant();

    /// <summary>Returns an error message, or null if the credentials are acceptable for registration.</summary>
    public static string? Validate(string? username, string? password)
    {
        var name = username?.Trim() ?? string.Empty;
        if (name.Length is < MinUsernameLength or > MaxUsernameLength || !UsernamePattern().IsMatch(name))
        {
            return $"Username must be {MinUsernameLength}-{MaxUsernameLength} characters: letters, digits and underscores only.";
        }

        if (string.IsNullOrEmpty(password) || password.Length is < MinPasswordLength or > MaxPasswordLength)
        {
            return $"Password must be {MinPasswordLength}-{MaxPasswordLength} characters.";
        }

        return null;
    }
}
