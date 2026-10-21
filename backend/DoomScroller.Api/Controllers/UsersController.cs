using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DoomScroller.Api.Controllers;

/// <summary>Public author pages: who someone is, what they've posted and (if they allow it) liked, and following them.</summary>
[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly IVideoRepository _videos;
    private readonly ILikeRepository _likes;
    private readonly ICommentRepository _comments;
    private readonly IFollowRepository _follows;
    private readonly IVideoPresenter _presenter;

    public UsersController(
        IUserRepository users,
        IVideoRepository videos,
        ILikeRepository likes,
        ICommentRepository comments,
        IFollowRepository follows,
        IVideoPresenter presenter)
    {
        _users = users;
        _videos = videos;
        _likes = likes;
        _comments = comments;
        _follows = follows;
        _presenter = presenter;
    }

    [HttpGet("{username}")]
    public async Task<ActionResult<ProfileDto>> GetProfile(string username, CancellationToken ct)
    {
        var author = await _users.FindByUsernameAsync(username, ct);
        if (author is null) return NotFound();

        var viewerId = User.GetUserId();
        var isSelf = viewerId == author.Id;

        var videoCount = await _videos.CountByAuthorAsync(author.Id, includeUnfinished: isSelf, ct);
        var likesReceived = await _likes.CountReceivedByAuthorAsync(author.Id, ct);
        var follow = await _follows.GetInfoAsync(author.Id, viewerId, ct);

        return Ok(new ProfileDto(
            author.Username,
            author.CreatedAtUtc,
            videoCount,
            likesReceived,
            author.Bio,
            MediaUrls.Avatar(author.AvatarFileName),
            follow.FollowerCount,
            follow.IsFollowing,
            isSelf,
            LikesVisible: isSelf || author.LikesPublic,
            LikesPublic: isSelf && author.LikesPublic));
    }

    /// <summary>
    /// The author's videos, newest first. Visitors see finished videos only; the author also sees
    /// their own queued/processing/failed uploads, which is how they follow progress.
    /// </summary>
    [HttpGet("{username}/videos")]
    public async Task<ActionResult<IReadOnlyList<VideoDto>>> GetVideos(
        string username, [FromQuery] int skip = 0, [FromQuery] int take = 10, CancellationToken ct = default)
    {
        var author = await _users.FindByUsernameAsync(username, ct);
        if (author is null) return NotFound();

        var viewerId = User.GetUserId();
        take = Math.Clamp(take, 1, 50);
        skip = Math.Max(skip, 0);

        var videos = await _videos.GetByAuthorAsync(author.Id, includeUnfinished: viewerId == author.Id, skip, take, ct);
        return Ok(await _presenter.PresentAsync(videos, viewerId, ct));
    }

    /// <summary>Comments this user has posted (on finished videos), newest first.</summary>
    [HttpGet("{username}/comments")]
    public async Task<ActionResult<IReadOnlyList<ProfileCommentDto>>> GetComments(
        string username, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var author = await _users.FindByUsernameAsync(username, ct);
        if (author is null) return NotFound();

        take = Math.Clamp(take, 1, 50);
        skip = Math.Max(skip, 0);

        var rows = await _comments.GetByAuthorAsync(author.Id, skip, take, ct);
        var likes = await _likes.GetCommentInfoAsync(rows.Select(r => r.Id).ToList(), User.GetUserId(), ct);

        return Ok(rows.Select(r =>
        {
            var info = likes.GetValueOrDefault(r.Id);
            return new ProfileCommentDto(
                r.Id, r.Text, r.CreatedAtUtc, info?.Count ?? 0, info?.LikedByViewer ?? false,
                new VideoRefDto(r.VideoId, r.VideoTitle, r.VideoAuthorUsername));
        }).ToList());
    }

    /// <summary>
    /// What this user has liked, videos and comments mixed, newest like first. Only the user themselves
    /// can see it unless they've chosen to make it public; anyone else gets 403.
    /// </summary>
    [HttpGet("{username}/likes")]
    public async Task<ActionResult<IReadOnlyList<LikedItemDto>>> GetLikes(
        string username, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var author = await _users.FindByUsernameAsync(username, ct);
        if (author is null) return NotFound();

        var viewerId = User.GetUserId();
        if (viewerId != author.Id && !author.LikesPublic) return Forbid();

        take = Math.Clamp(take, 1, 50);
        skip = Math.Max(skip, 0);

        // Videos and comments live in different tables, so take the newest (skip + take) of each and
        // merge them by like time; whatever ends up in positions [skip, skip + take) of that merge is
        // exactly the right page, however the two kinds interleave.
        var wanted = skip + take;
        var likedVideos = await _likes.GetLikedVideosAsync(author.Id, wanted, ct);
        var likedComments = await _likes.GetLikedCommentsAsync(author.Id, wanted, ct);

        var page = likedVideos.Select(v => (At: v.LikedAtUtc, Video: v, Comment: (LikedComment?)null))
            .Concat(likedComments.Select(c => (At: c.LikedAtUtc, Video: (LikedVideo?)null, Comment: (LikedComment?)c)))
            .OrderByDescending(x => x.At)
            .Skip(skip)
            .Take(take)
            .ToList();

        // Like info / counts for the page, fetched in bulk rather than per item.
        var videoDtos = (await _presenter.PresentAsync(
                page.Where(x => x.Video is not null).Select(x => x.Video!.Video).ToList(), viewerId, ct))
            .ToDictionary(v => v.Id);
        var commentLikes = await _likes.GetCommentInfoAsync(
            page.Where(x => x.Comment is not null).Select(x => x.Comment!.Comment.Id).ToList(), viewerId, ct);

        var items = page.Select(x => x.Video is not null
                ? new LikedItemDto("video", x.At, videoDtos[x.Video.Video.Id], null)
                : new LikedItemDto("comment", x.At, null, ToLikedCommentDto(x.Comment!.Comment, commentLikes.GetValueOrDefault(x.Comment.Comment.Id))))
            .ToList();

        return Ok(items);
    }

    /// <summary>Follow this user. Idempotent. You can't follow yourself.</summary>
    [HttpPut("{username}/follow")]
    [Authorize]
    public Task<ActionResult<FollowStateDto>> Follow(string username, CancellationToken ct) => SetFollowingAsync(username, true, ct);

    [HttpDelete("{username}/follow")]
    [Authorize]
    public Task<ActionResult<FollowStateDto>> Unfollow(string username, CancellationToken ct) => SetFollowingAsync(username, false, ct);

    private async Task<ActionResult<FollowStateDto>> SetFollowingAsync(string username, bool following, CancellationToken ct)
    {
        var target = await _users.FindByUsernameAsync(username, ct);
        if (target is null) return NotFound();

        var viewerId = User.GetUserId()!.Value;
        if (target.Id == viewerId) return BadRequest("You can't follow yourself.");

        var state = await _follows.SetFollowingAsync(viewerId, target.Id, following, ct);
        return Ok(new FollowStateDto(state.FollowerCount, state.IsFollowing));
    }

    private static LikedCommentDto ToLikedCommentDto(CommentOnVideo c, LikeInfo? likes) =>
        new(c.Id, c.Text, c.CreatedAtUtc, new AuthorDto(c.AuthorUsername),
            likes?.Count ?? 0, likes?.LikedByViewer ?? false,
            new VideoRefDto(c.VideoId, c.VideoTitle, c.VideoAuthorUsername));
}
