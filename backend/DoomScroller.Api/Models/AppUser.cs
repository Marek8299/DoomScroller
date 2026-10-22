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
    /// Whether other people can see what this user has liked. On by default for new accounts; the
    /// user can turn it off in Edit profile. (Accounts that existed before this default changed keep
    /// the value they already have: a silent switch to public would expose likes of people who
    /// never chose that.)
    /// </summary>
    public bool LikesPublic { get; set; } = true;

    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
