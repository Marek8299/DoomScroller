using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

public class EfFollowRepository : IFollowRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfFollowRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    public async Task<FollowInfo> GetInfoAsync(Guid userId, Guid? viewerId, CancellationToken ct = default)
    {
        var count = await _db.Follows.CountAsync(f => f.FolloweeId == userId, ct);
        var following = viewerId is not null && await ExistsAsync(viewerId.Value, userId, ct);
        return new FollowInfo(count, following);
    }

    public async Task<FollowInfo> SetFollowingAsync(Guid followerId, Guid followeeId, bool following, CancellationToken ct = default)
    {
        if (following)
        {
            if (!await ExistsAsync(followerId, followeeId, ct))
            {
                var follow = new Follow { FollowerId = followerId, FolloweeId = followeeId };
                _db.Follows.Add(follow);
                try
                {
                    await _db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException)
                {
                    // Two requests followed at the same moment (the primary key stopped the second: fine,
                    // it IS followed) or something is genuinely wrong, which must not be swallowed.
                    _db.Entry(follow).State = EntityState.Detached;
                    if (!await ExistsAsync(followerId, followeeId, ct)) throw;
                }
            }
        }
        else
        {
            await _db.Follows.Where(f => f.FollowerId == followerId && f.FolloweeId == followeeId).ExecuteDeleteAsync(ct);
        }

        var count = await _db.Follows.CountAsync(f => f.FolloweeId == followeeId, ct);
        return new FollowInfo(count, following);
    }

    private Task<bool> ExistsAsync(Guid followerId, Guid followeeId, CancellationToken ct) =>
        _db.Follows.AnyAsync(f => f.FollowerId == followerId && f.FolloweeId == followeeId, ct);
}
