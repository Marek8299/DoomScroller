using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DoomScroller.Api.Controllers;

[ApiController]
[Route("api/videos/{videoId:guid}/comments")]
public class CommentsController : ControllerBase
{
    private readonly ICommentRepository _comments;
    private readonly IVideoRepository _videos;

    public CommentsController(ICommentRepository comments, IVideoRepository videos)
    {
        _comments = comments;
        _videos = videos;
    }

    /// <summary>A video's comments, newest first. Anyone can read them; only finished videos have any.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CommentDto>>> List(
        Guid videoId, [FromQuery] int skip = 0, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var video = await FindPublicVideoAsync(videoId, ct);
        if (video is null) return NotFound();

        take = Math.Clamp(take, 1, 50);
        skip = Math.Max(skip, 0);

        var viewerId = User.GetUserId();
        var comments = await _comments.GetForVideoAsync(videoId, skip, take, ct);
        return Ok(comments.Select(c => ToDto(c, c.Author?.Username ?? "[deleted]", viewerId, video)).ToList());
    }

    [HttpPost]
    [Authorize]
    [EnableRateLimiting(AuthServiceCollectionExtensions.CommentsRateLimitPolicy)]
    public async Task<ActionResult<CommentDto>> Create(Guid videoId, CreateCommentRequest request, CancellationToken ct)
    {
        var (text, error) = CommentRules.Clean(request.Text);
        if (text is null) return BadRequest(error);

        var video = await FindPublicVideoAsync(videoId, ct);
        if (video is null) return NotFound();

        var viewerId = User.GetUserId()!.Value;
        var comment = new VideoComment { VideoId = videoId, AuthorId = viewerId, Text = text };
        await _comments.AddAsync(comment, ct);

        // The new entity has no Author loaded; the signed-in user's name is in their claims.
        return StatusCode(StatusCodes.Status201Created, ToDto(comment, User.Identity!.Name!, viewerId, video));
    }

    /// <summary>Delete a comment: its author can, and so can the author of the video it's on.</summary>
    [HttpDelete("{commentId:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid videoId, Guid commentId, CancellationToken ct)
    {
        var comment = await _comments.GetAsync(commentId, ct);
        if (comment is null || comment.VideoId != videoId) return NotFound();

        var viewerId = User.GetUserId();
        var video = await _videos.GetAsync(videoId, ct);
        var allowed = viewerId is not null && (comment.AuthorId == viewerId || video?.AuthorId == viewerId);
        if (!allowed) return Forbid();

        await _comments.DeleteAsync(commentId, ct);
        return NoContent();
    }

    /// <summary>Unfinished videos aren't public, so (as everywhere) they simply don't exist for commenting.</summary>
    private async Task<VideoItem?> FindPublicVideoAsync(Guid videoId, CancellationToken ct)
    {
        var video = await _videos.GetAsync(videoId, ct);
        return video is { Status: RenditionStatus.Ready } ? video : null;
    }

    private static CommentDto ToDto(VideoComment c, string authorName, Guid? viewerId, VideoItem video) =>
        new(c.Id, c.Text, c.CreatedAtUtc, new AuthorDto(authorName),
            CanDelete: viewerId is not null && (c.AuthorId == viewerId || video.AuthorId == viewerId));
}
