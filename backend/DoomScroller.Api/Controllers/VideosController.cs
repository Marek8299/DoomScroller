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
    private readonly IVideoProcessingQueue _queue;
    private readonly IWebHostEnvironment _env;
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
        IVideoProcessingQueue queue,
        IWebHostEnvironment env,
        IOptions<ConversionOptions> conversion,
        ILogger<VideosController> logger)
    {
        _repository = repository;
        _likes = likes;
        _presenter = presenter;
        _queue = queue;
        _env = env;
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

        var title = string.IsNullOrWhiteSpace(request.Title)
            ? Path.GetFileNameWithoutExtension(file.FileName)
            : request.Title.Trim();
        if (title.Length > UploadVideoRequest.MaxTitleLength)
        {
            return BadRequest($"Title can be at most {UploadVideoRequest.MaxTitleLength} characters.");
        }

        var description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        if (description is not null && description.Length > UploadVideoRequest.MaxDescriptionLength)
        {
            return BadRequest($"Description can be at most {UploadVideoRequest.MaxDescriptionLength} characters.");
        }

        var uploadsDir = Path.Combine(_env.ContentRootPath, "Storage", "uploads");
        Directory.CreateDirectory(uploadsDir);

        var video = new VideoItem
        {
            Title = title,
            Description = description,
            AuthorId = User.GetUserId(),
            NormalizeVolume = request.NormalizeVolume,
            OriginalFileName = file.FileName,
            SourceFilePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}{extension}"),
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
