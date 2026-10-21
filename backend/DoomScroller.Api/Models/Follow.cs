namespace DoomScroller.Api.Models;

/// <summary>One user following another. The composite key (FollowerId, FolloweeId) makes a double follow impossible.</summary>
public class Follow
{
    public Guid FollowerId { get; init; }
    public Guid FolloweeId { get; init; }
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
