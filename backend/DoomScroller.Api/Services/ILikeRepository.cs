using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

/// <summary>A video's like total, and whether the viewer asking has liked it.</summary>
public sealed record LikeInfo(int Count, bool LikedByViewer);

/// <summary>A comment together with the video it's on, as profile pages show it.</summary>
public sealed record CommentOnVideo(
    Guid Id,
    string Text,
    DateTimeOffset CreatedAtUtc,
    string AuthorUsername,
    Guid VideoId,
    string VideoTitle,
    string? VideoAuthorUsername);

public sealed record LikedVideo(VideoItem Video, DateTimeOffset LikedAtUtc);

public sealed record LikedComment(CommentOnVideo Comment, DateTimeOffset LikedAtUtc);

public interface ILikeRepository
{
    /// <summary>Like info for a page of videos in two queries (not one per video). Every requested id is present in the result.</summary>
    Task<IReadOnlyDictionary<Guid, LikeInfo>> GetInfoAsync(
        IReadOnlyCollection<Guid> videoIds, Guid? viewerId, CancellationToken ct = default);

    /// <summary>Idempotent: liking twice, or unliking something not liked, is not an error. Returns the resulting state.</summary>
    Task<LikeInfo> SetLikedAsync(Guid videoId, Guid userId, bool liked, CancellationToken ct = default);

    /// <summary>Total likes across an author's finished videos (for their profile).</summary>
    Task<int> CountReceivedByAuthorAsync(Guid authorId, CancellationToken ct = default);

    // --- comment likes ---

    /// <summary>Like info for a page of comments in two queries. Every requested id is present in the result.</summary>
    Task<IReadOnlyDictionary<Guid, LikeInfo>> GetCommentInfoAsync(
        IReadOnlyCollection<Guid> commentIds, Guid? viewerId, CancellationToken ct = default);

    /// <summary>Idempotent, like <see cref="SetLikedAsync"/>.</summary>
    Task<LikeInfo> SetCommentLikedAsync(Guid commentId, Guid userId, bool liked, CancellationToken ct = default);

    // --- what a user has liked (for the profile's Liked tab). Only content on finished videos is ever returned. ---

    /// <summary>The user's most recently liked videos, newest like first, at most <paramref name="take"/>.</summary>
    Task<IReadOnlyList<LikedVideo>> GetLikedVideosAsync(Guid userId, int take, CancellationToken ct = default);

    /// <summary>The user's most recently liked comments, newest like first, at most <paramref name="take"/>.</summary>
    Task<IReadOnlyList<LikedComment>> GetLikedCommentsAsync(Guid userId, int take, CancellationToken ct = default);
}
