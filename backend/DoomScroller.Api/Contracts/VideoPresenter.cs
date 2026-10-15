using DoomScroller.Api.Models;
using DoomScroller.Api.Services;

namespace DoomScroller.Api.Contracts;

/// <summary>
/// Turns videos into what the client sees, adding the per-video extras (like info, comment count)
/// in a fixed number of queries per page rather than per video. Controllers use this instead of
/// each re-assembling the same pieces.
/// </summary>
public interface IVideoPresenter
{
    Task<IReadOnlyList<VideoDto>> PresentAsync(IReadOnlyList<VideoItem> videos, Guid? viewerId, CancellationToken ct);
    Task<VideoDto> PresentAsync(VideoItem video, Guid? viewerId, CancellationToken ct);
}

public class VideoPresenter : IVideoPresenter
{
    private readonly ILikeRepository _likes;
    private readonly ICommentRepository _comments;

    public VideoPresenter(ILikeRepository likes, ICommentRepository comments)
    {
        _likes = likes;
        _comments = comments;
    }

    public async Task<IReadOnlyList<VideoDto>> PresentAsync(
        IReadOnlyList<VideoItem> videos, Guid? viewerId, CancellationToken ct)
    {
        var ids = videos.Select(v => v.Id).ToList();
        var likes = await _likes.GetInfoAsync(ids, viewerId, ct);
        var commentCounts = await _comments.GetCountsAsync(ids, ct);

        return videos
            .Select(v => VideoMapper.ToDto(v, viewerId, likes.GetValueOrDefault(v.Id), commentCounts.GetValueOrDefault(v.Id)))
            .ToList();
    }

    public async Task<VideoDto> PresentAsync(VideoItem video, Guid? viewerId, CancellationToken ct) =>
        (await PresentAsync(new[] { video }, viewerId, ct))[0];
}
