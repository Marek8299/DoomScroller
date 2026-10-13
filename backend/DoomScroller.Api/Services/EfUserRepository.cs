using DoomScroller.Api.Auth;
using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

public class EfUserRepository : IUserRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfUserRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    public Task<AppUser?> FindByUsernameAsync(string username, CancellationToken ct = default)
    {
        var normalized = CredentialRules.Normalize(username);
        return _db.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalized, ct);
    }

    public Task<AppUser?> GetAsync(Guid id, CancellationToken ct = default) =>
        _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<bool> TryAddAsync(AppUser user, CancellationToken ct = default)
    {
        if (await _db.Users.AnyAsync(u => u.NormalizedUsername == user.NormalizedUsername, ct))
        {
            return false;
        }

        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            // Lost a race with another registration of the same name: the unique index caught it.
            _db.Entry(user).State = EntityState.Detached;
            if (await _db.Users.AnyAsync(u => u.NormalizedUsername == user.NormalizedUsername, ct))
            {
                return false;
            }
            throw;
        }
    }

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
