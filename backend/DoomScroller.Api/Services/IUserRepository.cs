using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface IUserRepository
{
    /// <summary>Case-insensitive lookup by username.</summary>
    Task<AppUser?> FindByUsernameAsync(string username, CancellationToken ct = default);

    Task<AppUser?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Adds the user; returns false (and adds nothing) if the username is already taken.</summary>
    Task<bool> TryAddAsync(AppUser user, CancellationToken ct = default);

    Task SaveChangesAsync(CancellationToken ct = default);
}
