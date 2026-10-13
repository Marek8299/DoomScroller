using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DoomScroller.Api.Controllers;

[ApiController]
[Route("api/videos")]
public class VideosController : ControllerBase
{
    private readonly IVideoRepository _repository;
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
        IVideoProcessingQueue queue,
        IWebHostEnvironment env,
        IOptions<ConversionOptions> conversion,
        ILogger<VideosController> logger)
    {
        _repository = repository;
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
    [RequestSizeLimit(2_000_000_000)] // 2 GB - raise/lower to taste, also set Kestrel limits for real deployments
    public async Task<ActionResult<VideoItem>> Upload([FromForm] UploadVideoRequest request)
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

        return AcceptedAtAction(nameof(GetById), new { id = video.Id }, video);
    }

    /// <summary>The scrollable feed: most recently uploaded, fully-processed videos first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<VideoItem>>> GetFeed([FromQuery] int skip = 0, [FromQuery] int take = 10)
    {
        take = Math.Clamp(take, 1, 50);
        return Ok(await _repository.GetFeedAsync(skip, take));
    }

    /// <summary>Poll this while a video is Queued/Processing to find out when it's Ready.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<VideoItem>> GetById(Guid id)
    {
        var video = await _repository.GetAsync(id);
        return video is null ? NotFound() : Ok(video);
    }
}
