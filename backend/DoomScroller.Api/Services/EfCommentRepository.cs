using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

public class EfCommentRepository : ICommentRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfCommentRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<VideoComment>> GetForVideoAsync(
        Guid videoId, int skip, int take, CancellationToken ct = default) =>
        await _db.Comments
            .Include(c => c.Author)
            .Where(c => c.VideoId == videoId)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ThenByDescending(c => c.Id) // stable order for comments created in the same instant
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<CommentOnVideo>> GetByAuthorAsync(
        Guid authorId, int skip, int take, CancellationToken ct = default) =>
        await (from comment in _db.Comments
               where comment.AuthorId == authorId
               join video in _db.Videos on comment.VideoId equals video.Id
               where video.Status == RenditionStatus.Ready
               orderby comment.CreatedAtUtc descending, comment.Id descending
               select new CommentOnVideo(
                   comment.Id,
                   comment.Text,
                   comment.CreatedAtUtc,
                   comment.Author!.Username,
                   video.Id,
                   video.Title,
                   video.Author != null ? video.Author.Username : null))
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

    public Task<VideoComment?> GetAsync(Guid commentId, CancellationToken ct = default) =>
        _db.Comments.Include(c => c.Author).FirstOrDefaultAsync(c => c.Id == commentId, ct);

    public async Task AddAsync(VideoComment comment, CancellationToken ct = default)
    {
        _db.Comments.Add(comment);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteAsync(Guid commentId, CancellationToken ct = default) =>
        await _db.Comments.Where(c => c.Id == commentId).ExecuteDeleteAsync(ct) > 0;

    public async Task<IReadOnlyDictionary<Guid, int>> GetCountsAsync(
        IReadOnlyCollection<Guid> videoIds, CancellationToken ct = default)
    {
        var ids = videoIds.Distinct().ToArray();
        if (ids.Length == 0) return new Dictionary<Guid, int>();

        var counts = await _db.Comments
            .Where(c => ids.Contains(c.VideoId))
            .GroupBy(c => c.VideoId)
            .Select(g => new { VideoId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.VideoId, x => x.Count, ct);

        return ids.ToDictionary(id => id, id => counts.GetValueOrDefault(id));
    }

    public Task<int> CountForVideoAsync(Guid videoId, CancellationToken ct = default) =>
        _db.Comments.CountAsync(c => c.VideoId == videoId, ct);
}
