using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Controllers;

[ApiController]
[Route("api/videos")]
public class VideosController : ControllerBase
{
    private readonly IVideoRepository _repository;
    private readonly ILikeRepository _likes;
    private readonly IVideoPresenter _presenter;
    private readonly IMediaFileCleaner _files;
    private readonly IVideoProcessingQueue _queue;
    private readonly StoragePaths _storage;
    private readonly ConversionOptions _conversion;
    private readonly ILogger<VideosController> _logger;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"
    };

    public VideosController(
        IVideoRepository repository,
        ILikeRepository likes,
        IVideoPresenter presenter,
        IMediaFileCleaner files,
        IVideoProcessingQueue queue,
        StoragePaths storage,
        IOptions<ConversionOptions> conversion,
        ILogger<VideosController> logger)
    {
        _repository = repository;
        _likes = likes;
        _presenter = presenter;
        _files = files;
        _queue = queue;
        _storage = storage;
        _conversion = conversion.Value;
        _logger = logger;
    }

    /// <summary>
    /// Upload a video with a title and optional description. Returns immediately with the new
    /// video's id and status = Queued; transcoding happens in the background using the
    /// server-configured "Conversion" settings.
    /// </summary>
    [HttpPost]
    [Authorize]
    [RequestSizeLimit(2_000_000_000)] // 2 GB - raise/lower to taste, also set Kestrel limits for real deployments
    public async Task<ActionResult<VideoDto>> Upload([FromForm] UploadVideoRequest request)
    {
        var file = request.File;
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file uploaded.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest($"Unsupported file extension '{extension}'.");
        }

        var (title, description, error) = VideoMetadataRules.Clean(
            request.Title, request.Description, fallbackTitle: Path.GetFileNameWithoutExtension(file.FileName));
        if (title is null) return BadRequest(error);

        Directory.CreateDirectory(_storage.Uploads);

        var video = new VideoItem
        {
            Title = title,
            Description = description,
            AuthorId = User.GetUserId(),
            NormalizeVolume = request.NormalizeVolume,
            OriginalFileName = file.FileName,
            SourceFilePath = Path.Combine(_storage.Uploads, $"{Guid.NewGuid()}{extension}"),
            // Snapshot of the server config at upload time, so a later config change doesn't
            // rewrite history for videos that are already queued or encoded.
            Options = _conversion.Clone()
        };

        await using (var stream = System.IO.File.Create(video.SourceFilePath))
        {
            await file.CopyToAsync(stream);
        }

        await _repository.AddAsync(video);
        _queue.Enqueue(video.Id);

        _logger.LogInformation("Queued video {VideoId} ({FileName}, {Bytes} bytes)", video.Id, file.FileName, file.Length);

        // The new entity has no Author navigation loaded; the signed-in user's name is in their claims.
        var dto = VideoMapper.ToDto(video, video.AuthorId) with { Author = new AuthorDto(User.Identity!.Name!) };
        return AcceptedAtAction(nameof(GetById), new { id = video.Id }, dto);
    }

    /// <summary>The scrollable feed: most recently uploaded, fully-processed videos first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<VideoDto>>> GetFeed(
        [FromQuery] int skip = 0, [FromQuery] int take = 10, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        skip = Math.Max(skip, 0);

        var viewerId = User.GetUserId();
        var videos = await _repository.GetFeedAsync(skip, take, ct);
        return Ok(await _presenter.PresentAsync(videos, viewerId, ct));
    }

    /// <summary>
    /// Poll this while a video is Queued/Processing to find out when it's Ready. Unfinished videos
    /// are only visible to their author; everyone else gets a 404.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<VideoDto>> GetById(Guid id, CancellationToken ct)
    {
        var video = await _repository.GetAsync(id, ct);
        var viewerId = User.GetUserId();

        if (video is null || (video.Status != RenditionStatus.Ready && video.AuthorId != viewerId))
        {
            return NotFound();
        }

        return Ok(await _presenter.PresentAsync(video, viewerId, ct));
    }

    /// <summary>
    /// Change a video's title and description (owner only). Both fields are applied as sent: a blank
    /// description clears it. Works on unfinished videos too, since it never touches the encoding.
    /// </summary>
    [HttpPatch("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<VideoDto>> Update(Guid id, UpdateVideoRequest request, CancellationToken ct)
    {
        var (video, denied) = await FindOwnedVideoAsync(id, ct);
        if (video is null) return denied!;

        var (title, description, error) = VideoMetadataRules.Clean(request.Title, request.Description);
        if (title is null) return BadRequest(error);

        video.Title = title;
        video.Description = description;
        await _repository.SaveChangesAsync(ct);

        return Ok(await _presenter.PresentAsync(video, User.GetUserId(), ct));
    }

    /// <summary>
    /// Delete a video and everything attached to it (owner only): its renditions, likes and
    /// comments, and the files on disk. Allowed in any state, so a failed or stuck upload can be removed too.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var (video, denied) = await FindOwnedVideoAsync(id, ct);
        if (video is null) return denied!;

        // Collect the paths first: the entity is gone after the delete.
        var files = video.Renditions.Select(r => (string?)r.FilePath).Append(video.SourceFilePath).ToList();
        if (video.ThumbnailFileName is not null) files.Add(Path.Combine(_storage.Thumbs, video.ThumbnailFileName));

        // Database first, files second. If the files can't be removed we're left with clutter on disk;
        // the other way round could leave a video in the feed whose files are already gone.
        await _repository.DeleteAsync(video, ct);
        _files.DeleteFiles(files);

        _logger.LogInformation("Deleted video {VideoId} and {Count} file(s)", id, files.Count);
        return NoContent();
    }

    /// <summary>
    /// Finds a video the caller owns. Otherwise says why not: a missing video, or someone else's
    /// unfinished one (which isn't public), is 404; someone else's published one is 403.
    /// </summary>
    private async Task<(VideoItem? Video, ActionResult? Denied)> FindOwnedVideoAsync(Guid id, CancellationToken ct)
    {
        var video = await _repository.GetAsync(id, ct);
        var viewerId = User.GetUserId();

        if (video is null) return (null, NotFound());
        if (video.AuthorId is not null && video.AuthorId == viewerId) return (video, null);

        return (null, video.Status == RenditionStatus.Ready ? Forbid() : NotFound());
    }

    /// <summary>Like a video. Idempotent: liking it again changes nothing.</summary>
    [HttpPut("{id:guid}/like")]
    [Authorize]
    public Task<ActionResult<LikeStateDto>> Like(Guid id, CancellationToken ct) => SetLikedAsync(id, true, ct);

    /// <summary>Remove your like. Idempotent: fine if you hadn't liked it.</summary>
    [HttpDelete("{id:guid}/like")]
    [Authorize]
    public Task<ActionResult<LikeStateDto>> Unlike(Guid id, CancellationToken ct) => SetLikedAsync(id, false, ct);

    private async Task<ActionResult<LikeStateDto>> SetLikedAsync(Guid videoId, bool liked, CancellationToken ct)
    {
        // Only finished videos are public, so only those can be liked (an unfinished one is a 404, like everywhere else).
        var video = await _repository.GetAsync(videoId, ct);
        if (video is null || video.Status != RenditionStatus.Ready) return NotFound();

        var state = await _likes.SetLikedAsync(videoId, User.GetUserId()!.Value, liked, ct);
        return Ok(new LikeStateDto(state.Count, state.LikedByViewer));
    }
}
