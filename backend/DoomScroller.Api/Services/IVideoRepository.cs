using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface IVideoRepository
{
    Task AddAsync(VideoItem video, CancellationToken ct = default);
    Task<VideoItem?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>Ready videos from everyone, newest first.</summary>
    Task<IReadOnlyList<VideoItem>> GetFeedAsync(int skip, int take, CancellationToken ct = default);

    /// <summary>One author's videos, newest first. <paramref name="includeUnfinished"/> adds queued/processing/failed ones (for the author's own view).</summary>
    Task<IReadOnlyList<VideoItem>> GetByAuthorAsync(Guid authorId, bool includeUnfinished, int skip, int take, CancellationToken ct = default);

    Task<int> CountByAuthorAsync(Guid authorId, bool includeUnfinished, CancellationToken ct = default);

    /// <summary>
    /// Removes a video previously returned by this repository instance, including its renditions
    /// (likes and comments go with it via cascading deletes). Not an error if it's already gone.
    /// </summary>
    Task DeleteAsync(VideoItem video, CancellationToken ct = default);

    /// <summary>
    /// Persists changes made to an entity previously returned by this same repository
    /// instance (i.e. within the same DbContext/scope) - there's nothing to re-attach,
    /// just flush the tracked changes. Throws <see cref="VideoGoneException"/> if the video was deleted in the meantime.
    /// </summary>
    Task SaveChangesAsync(CancellationToken ct = default);
}
