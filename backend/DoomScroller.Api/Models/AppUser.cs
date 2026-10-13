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

    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
