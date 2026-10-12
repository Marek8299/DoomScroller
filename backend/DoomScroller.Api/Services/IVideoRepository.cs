using System.Collections.Concurrent;
using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface IVideoRepository
{
    void Add(VideoItem video);
    VideoItem? Get(Guid id);
    VideoRendition? GetRendition(Guid renditionId, out VideoItem? owner);
    IReadOnlyList<VideoItem> GetFeed(int skip, int take);
}

/// <summary>
/// Simple process-lifetime store. Good enough for a demo clone; swap for EF Core + a
/// real database (Postgres/SQL Server) once you need videos to survive a restart.
/// </summary>
public class InMemoryVideoRepository : IVideoRepository
{
    private readonly ConcurrentDictionary<Guid, VideoItem> _videos = new();

    public void Add(VideoItem video) => _videos[video.Id] = video;

    public VideoItem? Get(Guid id) => _videos.GetValueOrDefault(id);

    public VideoRendition? GetRendition(Guid renditionId, out VideoItem? owner)
    {
        foreach (var video in _videos.Values)
        {
            var rendition = video.Renditions.FirstOrDefault(r => r.Id == renditionId);
            if (rendition is not null)
            {
                owner = video;
                return rendition;
            }
        }
        owner = null;
        return null;
    }

    public IReadOnlyList<VideoItem> GetFeed(int skip, int take) =>
        _videos.Values
            .Where(v => v.Status == RenditionStatus.Ready)
            .OrderByDescending(v => v.UploadedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToList();
}
