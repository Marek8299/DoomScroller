using DoomScroller.Api.Models;

namespace DoomScroller.Api.Contracts;

// What the API actually sends to clients. Entities (and anything sensitive on them, like
// password hashes or server file paths) never go over the wire directly.

public record AuthorDto(string Username);

public record ProbeDto(int Width, int Height, double DurationSeconds);

public record VideoRenditionDto(
    Guid Id,
    int Height,
    bool IsOriginalResolution,
    ContainerFormat Container,
    string VideoCodec,
    string AudioCodec,
    long SizeBytes,
    RenditionStatus Status,
    string Url);

public record VideoDto(
    Guid Id,
    string Title,
    string? Description,
    DateTimeOffset UploadedAtUtc,
    RenditionStatus Status,
    string? ErrorMessage,
    ProbeDto? Probe,
    AuthorDto? Author,
    IReadOnlyList<VideoRenditionDto> Renditions,
    int LikeCount,
    bool LikedByMe,
    int CommentCount,
    bool IsOwner,
    string? ThumbnailUrl);

public record CommentDto(
    Guid Id, string Text, DateTimeOffset CreatedAtUtc, AuthorDto Author, bool CanDelete, int LikeCount, bool LikedByMe);

public record LikeStateDto(int LikeCount, bool Liked);

public record CurrentUserDto(Guid Id, string Username);

public record ProfileDto(
    string Username,
    DateTimeOffset CreatedAtUtc,
    int VideoCount,
    int LikeCount,
    string? Bio,
    string? AvatarUrl,
    int FollowerCount,
    bool IsFollowing,
    bool IsSelf,
    /// <summary>Whether the viewer may see this user's Liked tab (the owner always can; others only if the owner allows it).</summary>
    bool LikesVisible,
    /// <summary>The owner's own setting. Only reported to the owner; always false for everyone else.</summary>
    bool LikesPublic);

public record FollowStateDto(int FollowerCount, bool Following);

public record VideoRefDto(Guid Id, string Title, string? AuthorUsername);

public record ProfileCommentDto(
    Guid Id, string Text, DateTimeOffset CreatedAtUtc, int LikeCount, bool LikedByMe, VideoRefDto Video);

public record LikedCommentDto(
    Guid Id, string Text, DateTimeOffset CreatedAtUtc, AuthorDto Author, int LikeCount, bool LikedByMe, VideoRefDto Video);

/// <summary>One entry of the Liked tab: exactly one of <see cref="Video"/> / <see cref="Comment"/> is set, matching <see cref="Type"/> ("video" or "comment").</summary>
public record LikedItemDto(string Type, DateTimeOffset LikedAtUtc, VideoDto? Video, LikedCommentDto? Comment);

/// <summary>What changed after editing your own profile.</summary>
public record ProfileEditDto(string? Bio, string? AvatarUrl, bool LikesPublic);
