using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DoomScroller.Api.Controllers;

/// <summary>Public author pages: who someone is and everything they've posted.</summary>
[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly IVideoRepository _videos;
    private readonly ILikeRepository _likes;
    private readonly IVideoPresenter _presenter;

    public UsersController(IUserRepository users, IVideoRepository videos, ILikeRepository likes, IVideoPresenter presenter)
    {
        _users = users;
        _videos = videos;
        _likes = likes;
        _presenter = presenter;
    }

    [HttpGet("{username}")]
    public async Task<ActionResult<ProfileDto>> GetProfile(string username, CancellationToken ct)
    {
        var author = await _users.FindByUsernameAsync(username, ct);
        if (author is null) return NotFound();

        var isOwner = User.GetUserId() == author.Id;
        var count = await _videos.CountByAuthorAsync(author.Id, includeUnfinished: isOwner, ct);
        var likes = await _likes.CountReceivedByAuthorAsync(author.Id, ct);
        return Ok(new ProfileDto(author.Username, author.CreatedAtUtc, count, likes));
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
}
