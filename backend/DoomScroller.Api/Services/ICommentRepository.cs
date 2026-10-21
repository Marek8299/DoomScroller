using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface ICommentRepository
{
    /// <summary>A video's comments, newest first, with authors loaded.</summary>
    Task<IReadOnlyList<VideoComment>> GetForVideoAsync(Guid videoId, int skip, int take, CancellationToken ct = default);

    Task<VideoComment?> GetAsync(Guid commentId, CancellationToken ct = default);

    Task AddAsync(VideoComment comment, CancellationToken ct = default);

    /// <summary>Returns false if there was nothing to delete (already gone).</summary>
    Task<bool> DeleteAsync(Guid commentId, CancellationToken ct = default);

    /// <summary>One user's comments on finished videos, newest first, each with the video it's on.</summary>
    Task<IReadOnlyList<CommentOnVideo>> GetByAuthorAsync(Guid authorId, int skip, int take, CancellationToken ct = default);

    /// <summary>Comment totals for a page of videos in one query. Videos without comments are present with 0.</summary>
    Task<IReadOnlyDictionary<Guid, int>> GetCountsAsync(IReadOnlyCollection<Guid> videoIds, CancellationToken ct = default);

    Task<int> CountForVideoAsync(Guid videoId, CancellationToken ct = default);
}
