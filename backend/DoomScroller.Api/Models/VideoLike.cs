namespace DoomScroller.Api.Models;

/// <summary>
/// One user liking one video. The composite primary key (VideoId, UserId) is what makes a double
/// like impossible: the database itself rejects a second row for the same pair.
/// </summary>
public class VideoLike
{
    public Guid VideoId { get; init; }
    public Guid UserId { get; init; }
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
