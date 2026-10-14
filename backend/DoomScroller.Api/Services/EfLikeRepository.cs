using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

public class EfLikeRepository : ILikeRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfLikeRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyDictionary<Guid, LikeInfo>> GetInfoAsync(
        IReadOnlyCollection<Guid> videoIds, Guid? viewerId, CancellationToken ct = default)
    {
        var ids = videoIds.ToArray();
        if (ids.Length == 0) return new Dictionary<Guid, LikeInfo>();

        var counts = await _db.Likes
            .Where(l => ids.Contains(l.VideoId))
            .GroupBy(l => l.VideoId)
            .Select(g => new { VideoId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.VideoId, x => x.Count, ct);

        var likedByViewer = viewerId is null
            ? new HashSet<Guid>()
            : (await _db.Likes
                .Where(l => l.UserId == viewerId && ids.Contains(l.VideoId))
                .Select(l => l.VideoId)
                .ToListAsync(ct)).ToHashSet();

        return ids.Distinct().ToDictionary(
            id => id,
            id => new LikeInfo(counts.GetValueOrDefault(id), likedByViewer.Contains(id)));
    }

    public async Task<LikeInfo> SetLikedAsync(Guid videoId, Guid userId, bool liked, CancellationToken ct = default)
    {
        if (liked)
        {
            if (!await ExistsAsync(videoId, userId, ct))
            {
                var like = new VideoLike { VideoId = videoId, UserId = userId };
                _db.Likes.Add(like);
                try
                {
                    await _db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException)
                {
                    // Either two requests liked at the same moment (the primary key stopped the
                    // second, which is fine: it IS liked), or something is genuinely wrong (a
                    // missing video/user breaking a foreign key), which we must not swallow.
                    _db.Entry(like).State = EntityState.Detached;
                    if (!await ExistsAsync(videoId, userId, ct)) throw;
                }
            }
        }
        else
        {
            await _db.Likes.Where(l => l.VideoId == videoId && l.UserId == userId).ExecuteDeleteAsync(ct);
        }

        var count = await _db.Likes.CountAsync(l => l.VideoId == videoId, ct);
        return new LikeInfo(count, liked);
    }

    public Task<int> CountReceivedByAuthorAsync(Guid authorId, CancellationToken ct = default) =>
        (from like in _db.Likes
         join video in _db.Videos on like.VideoId equals video.Id
         where video.AuthorId == authorId && video.Status == RenditionStatus.Ready
         select like).CountAsync(ct);

    private Task<bool> ExistsAsync(Guid videoId, Guid userId, CancellationToken ct) =>
        _db.Likes.AnyAsync(l => l.VideoId == videoId && l.UserId == userId, ct);
}
