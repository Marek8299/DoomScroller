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

    // ----- comment likes -----

    public async Task<IReadOnlyDictionary<Guid, LikeInfo>> GetCommentInfoAsync(
        IReadOnlyCollection<Guid> commentIds, Guid? viewerId, CancellationToken ct = default)
    {
        var ids = commentIds.Distinct().ToArray();
        if (ids.Length == 0) return new Dictionary<Guid, LikeInfo>();

        var counts = await _db.CommentLikes
            .Where(l => ids.Contains(l.CommentId))
            .GroupBy(l => l.CommentId)
            .Select(g => new { CommentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CommentId, x => x.Count, ct);

        var likedByViewer = viewerId is null
            ? new HashSet<Guid>()
            : (await _db.CommentLikes
                .Where(l => l.UserId == viewerId && ids.Contains(l.CommentId))
                .Select(l => l.CommentId)
                .ToListAsync(ct)).ToHashSet();

        return ids.ToDictionary(id => id, id => new LikeInfo(counts.GetValueOrDefault(id), likedByViewer.Contains(id)));
    }

    public async Task<LikeInfo> SetCommentLikedAsync(Guid commentId, Guid userId, bool liked, CancellationToken ct = default)
    {
        if (liked)
        {
            if (!await CommentLikeExistsAsync(commentId, userId, ct))
            {
                var like = new CommentLike { CommentId = commentId, UserId = userId };
                _db.CommentLikes.Add(like);
                try
                {
                    await _db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException)
                {
                    _db.Entry(like).State = EntityState.Detached; // lost a race with an identical request, or a real problem
                    if (!await CommentLikeExistsAsync(commentId, userId, ct)) throw;
                }
            }
        }
        else
        {
            await _db.CommentLikes.Where(l => l.CommentId == commentId && l.UserId == userId).ExecuteDeleteAsync(ct);
        }

        var count = await _db.CommentLikes.CountAsync(l => l.CommentId == commentId, ct);
        return new LikeInfo(count, liked);
    }

    // ----- liked content -----

    public async Task<IReadOnlyList<LikedVideo>> GetLikedVideosAsync(Guid userId, int take, CancellationToken ct = default)
    {
        // Step 1: which videos, newest like first (only ones that are public).
        var likes = await (
            from like in _db.Likes
            where like.UserId == userId
            join video in _db.Videos on like.VideoId equals video.Id
            where video.Status == RenditionStatus.Ready
            orderby like.CreatedAtUtc descending
            select new { like.VideoId, like.CreatedAtUtc })
            .Take(take)
            .ToListAsync(ct);
        if (likes.Count == 0) return Array.Empty<LikedVideo>();

        // Step 2: the videos themselves, with what the response needs.
        var ids = likes.Select(l => l.VideoId).ToArray();
        var videos = await _db.Videos
            .Include(v => v.Renditions)
            .Include(v => v.Author)
            .Where(v => ids.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, ct);

        return likes.Select(l => new LikedVideo(videos[l.VideoId], l.CreatedAtUtc)).ToList();
    }

    public async Task<IReadOnlyList<LikedComment>> GetLikedCommentsAsync(Guid userId, int take, CancellationToken ct = default)
    {
        var likes = await (
            from like in _db.CommentLikes
            where like.UserId == userId
            join comment in _db.Comments on like.CommentId equals comment.Id
            join video in _db.Videos on comment.VideoId equals video.Id
            where video.Status == RenditionStatus.Ready
            orderby like.CreatedAtUtc descending
            select new { like.CommentId, like.CreatedAtUtc })
            .Take(take)
            .ToListAsync(ct);
        if (likes.Count == 0) return Array.Empty<LikedComment>();

        var ids = likes.Select(l => l.CommentId).ToArray();
        var comments = await (
            from comment in _db.Comments
            where ids.Contains(comment.Id)
            join video in _db.Videos on comment.VideoId equals video.Id
            select new CommentOnVideo(
                comment.Id,
                comment.Text,
                comment.CreatedAtUtc,
                comment.Author!.Username,
                video.Id,
                video.Title,
                video.Author != null ? video.Author.Username : null))
            .ToDictionaryAsync(c => c.Id, ct);

        return likes.Select(l => new LikedComment(comments[l.CommentId], l.CreatedAtUtc)).ToList();
    }

    private Task<bool> CommentLikeExistsAsync(Guid commentId, Guid userId, CancellationToken ct) =>
        _db.CommentLikes.AnyAsync(l => l.CommentId == commentId && l.UserId == userId, ct);

    private Task<bool> ExistsAsync(Guid videoId, Guid userId, CancellationToken ct) =>
        _db.Likes.AnyAsync(l => l.VideoId == videoId && l.UserId == userId, ct);
}
