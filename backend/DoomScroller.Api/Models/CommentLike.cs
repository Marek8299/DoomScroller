namespace DoomScroller.Api.Models;

/// <summary>One user liking one comment. The composite key (CommentId, UserId) makes a double like impossible.</summary>
public class CommentLike
{
    public Guid CommentId { get; init; }
    public Guid UserId { get; init; }
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
