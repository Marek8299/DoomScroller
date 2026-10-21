namespace DoomScroller.Api.Models;

/// <summary>
/// A registered account. Never serialised to API responses (see Contracts/ for what clients get),
/// so the password hash cannot leak. Named AppUser because controllers already have a `User` property.
/// </summary>
public class AppUser
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>The handle as the user typed it (shown in the UI, used in /u/{username}).</summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>Lower-cased username; unique, so "Marek" and "marek" can't both register.</summary>
    public string NormalizedUsername { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>Short self-description shown on the profile (see ProfileRules for the limits).</summary>
    public string? Bio { get; set; }

    /// <summary>
    /// File name (not path) of the profile picture inside Storage/avatars, or null for none. A new
    /// name is generated on every change, so each picture's URL never changes and can be cached forever.
    /// </summary>
    public string? AvatarFileName { get; set; }

    /// <summary>
    /// Whether other people can see what this user has liked. Off by default: likes are more private
    /// than posts, so exposing them is the user's choice.
    /// </summary>
    public bool LikesPublic { get; set; }

    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
