using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

/// <summary>EF Core-backed repository. Works against whichever provider (SQLite/MySQL) is registered in DI.</summary>
public class EfVideoRepository : IVideoRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfVideoRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    private IQueryable<VideoItem> Videos =>
        _db.Videos.Include(v => v.Renditions).Include(v => v.Author);

    public async Task AddAsync(VideoItem video, CancellationToken ct = default)
    {
        _db.Videos.Add(video);
        await _db.SaveChangesAsync(ct);
    }

    public Task<VideoItem?> GetAsync(Guid id, CancellationToken ct = default) =>
        Videos.FirstOrDefaultAsync(v => v.Id == id, ct);

    public async Task<IReadOnlyList<VideoItem>> GetFeedAsync(int skip, int take, CancellationToken ct = default) =>
        await Videos
            .Where(v => v.Status == RenditionStatus.Ready)
            .OrderByDescending(v => v.UploadedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VideoItem>> GetByAuthorAsync(
        Guid authorId, bool includeUnfinished, int skip, int take, CancellationToken ct = default) =>
        await Videos
            .Where(v => v.AuthorId == authorId && (includeUnfinished || v.Status == RenditionStatus.Ready))
            .OrderByDescending(v => v.UploadedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

    public Task<int> CountByAuthorAsync(Guid authorId, bool includeUnfinished, CancellationToken ct = default) =>
        _db.Videos.CountAsync(
            v => v.AuthorId == authorId && (includeUnfinished || v.Status == RenditionStatus.Ready), ct);

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
