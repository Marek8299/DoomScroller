using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace DoomScroller.Api.Controllers;

[ApiController]
[Route("api/videos")]
public class VideosController : ControllerBase
{
    private readonly IVideoRepository _repository;
    private readonly IVideoProcessingQueue _queue;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<VideosController> _logger;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"
    };

    public VideosController(
        IVideoRepository repository,
        IVideoProcessingQueue queue,
        IWebHostEnvironment env,
        ILogger<VideosController> logger)
    {
        _repository = repository;
        _queue = queue;
        _env = env;
        _logger = logger;
    }

    /// <summary>
    /// Upload a source video plus the desired conversion options. Returns immediately
    /// with the new video's id and status = Queued; transcoding happens in the background.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(2_000_000_000)] // 2 GB - raise/lower to taste, also set Kestrel limits for real deployments
    public async Task<ActionResult<VideoItem>> Upload(
        [FromForm] IFormFile file,
        [FromForm] string? title,
        [FromForm] EncodingPreset preset = EncodingPreset.WebOptimized,
        [FromForm] ContainerFormat container = ContainerFormat.Mp4,
        [FromForm] bool forceCopyAudioIfSupported = true,
        [FromForm] string resolutionTargets = "original")
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("No file uploaded.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            return BadRequest($"Unsupported file extension '{extension}'.");
        }

        var uploadsDir = Path.Combine(_env.ContentRootPath, "Storage", "uploads");
        Directory.CreateDirectory(uploadsDir);

        var video = new VideoItem
        {
            Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title,
            OriginalFileName = file.FileName,
            SourceFilePath = Path.Combine(uploadsDir, $"{Guid.NewGuid()}{extension}"),
            Options = new ConversionOptions
            {
                Preset = preset,
                Container = container,
                ForceCopyAudioIfSupported = forceCopyAudioIfSupported,
                ResolutionTargets = resolutionTargets
            }
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
