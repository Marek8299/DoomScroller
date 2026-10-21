namespace DoomScroller.Api.Services;

/// <summary>A user's follower total, and whether the viewer asking follows them.</summary>
public sealed record FollowInfo(int FollowerCount, bool IsFollowing);

public interface IFollowRepository
{
    Task<FollowInfo> GetInfoAsync(Guid userId, Guid? viewerId, CancellationToken ct = default);

    /// <summary>Idempotent: following twice, or unfollowing someone you don't follow, is not an error. Returns the resulting state.</summary>
    Task<FollowInfo> SetFollowingAsync(Guid followerId, Guid followeeId, bool following, CancellationToken ct = default);
}
