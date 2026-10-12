using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DoomScroller.Api.Services;

public interface IVideoRepository
{
    Task AddAsync(VideoItem video, CancellationToken ct = default);
    Task<VideoItem?> GetAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<VideoItem>> GetFeedAsync(int skip, int take, CancellationToken ct = default);

    /// <summary>
    /// Persists changes made to an entity previously returned by this same repository
    /// instance (i.e. within the same DbContext/scope) - there's nothing to re-attach,
    /// just flush the tracked changes.
    /// </summary>
    Task SaveChangesAsync(CancellationToken ct = default);
}

/// <summary>EF Core-backed repository. Works against whichever provider (SQLite/MySQL) is registered in DI.</summary>
public class EfVideoRepository : IVideoRepository
{
    private readonly DoomScrollerDbContext _db;

    public EfVideoRepository(DoomScrollerDbContext db)
    {
        _db = db;
    }

    public async Task AddAsync(VideoItem video, CancellationToken ct = default)
    {
        _db.Videos.Add(video);
        await _db.SaveChangesAsync(ct);
    }

    public Task<VideoItem?> GetAsync(Guid id, CancellationToken ct = default) =>
        _db.Videos.Include(v => v.Renditions).FirstOrDefaultAsync(v => v.Id == id, ct);

    public async Task<IReadOnlyList<VideoItem>> GetFeedAsync(int skip, int take, CancellationToken ct = default) =>
        await _db.Videos
            .Include(v => v.Renditions)
            .Where(v => v.Status == RenditionStatus.Ready)
            .OrderByDescending(v => v.UploadedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
