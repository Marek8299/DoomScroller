namespace DoomScroller.Api.Services;

/// <summary>A video's like total, and whether the viewer asking has liked it.</summary>
public sealed record LikeInfo(int Count, bool LikedByViewer);

public interface ILikeRepository
{
    /// <summary>Like info for a page of videos in two queries (not one per video). Every requested id is present in the result.</summary>
    Task<IReadOnlyDictionary<Guid, LikeInfo>> GetInfoAsync(
        IReadOnlyCollection<Guid> videoIds, Guid? viewerId, CancellationToken ct = default);

    /// <summary>Idempotent: liking twice, or unliking something not liked, is not an error. Returns the resulting state.</summary>
    Task<LikeInfo> SetLikedAsync(Guid videoId, Guid userId, bool liked, CancellationToken ct = default);

    /// <summary>Total likes across an author's finished videos (for their profile).</summary>
    Task<int> CountReceivedByAuthorAsync(Guid authorId, CancellationToken ct = default);
}
