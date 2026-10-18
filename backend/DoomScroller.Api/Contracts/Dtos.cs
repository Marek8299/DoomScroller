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
    bool IsOwner);

public record CommentDto(Guid Id, string Text, DateTimeOffset CreatedAtUtc, AuthorDto Author, bool CanDelete);

public record LikeStateDto(int LikeCount, bool Liked);

public record CurrentUserDto(Guid Id, string Username);

public record ProfileDto(string Username, DateTimeOffset CreatedAtUtc, int VideoCount, int LikeCount);
