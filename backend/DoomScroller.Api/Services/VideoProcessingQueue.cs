using System.Threading.Channels;
using DoomScroller.Api.Models;

namespace DoomScroller.Api.Services;

public interface IVideoProcessingQueue
{
    void Enqueue(Guid videoId);
    IAsyncEnumerable<Guid> ReadAllAsync(CancellationToken ct);
}

public class VideoProcessingQueue : IVideoProcessingQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();

    public void Enqueue(Guid videoId) => _channel.Writer.TryWrite(videoId);

    public IAsyncEnumerable<Guid> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

/// <summary>
/// Pulls uploaded videos off the queue and runs them through ffmpeg one at a time.
/// Keeping this out of the HTTP request means a big upload returns immediately with
/// "queued" and the client polls (or gets pushed, if you wire up SignalR) for progress.
/// </summary>
public class VideoProcessingWorker : BackgroundService
{
    private readonly IVideoProcessingQueue _queue;
    private readonly IVideoRepository _repository;
    private readonly IFfmpegService _ffmpeg;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<VideoProcessingWorker> _logger;

    public VideoProcessingWorker(
        IVideoProcessingQueue queue,
        IVideoRepository repository,
        IFfmpegService ffmpeg,
        IWebHostEnvironment env,
        ILogger<VideoProcessingWorker> logger)
    {
        _queue = queue;
        _repository = repository;
        _ffmpeg = ffmpeg;
        _env = env;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var videoId in _queue.ReadAllAsync(stoppingToken))
        {
            var video = _repository.Get(videoId);
            if (video is null) continue;

            try
            {
                video.Status = RenditionStatus.Processing;

                video.Probe = await _ffmpeg.ProbeAsync(video.SourceFilePath, stoppingToken);

                var mediaDir = Path.Combine(_env.ContentRootPath, "Storage", "media");
                var renditions = await _ffmpeg.ConvertAllRenditionsAsync(
                    video.SourceFilePath,
                    video.Probe,
                    video.Options,
                    mediaDir,
                    ct: stoppingToken);

                video.Renditions.AddRange(renditions);
                video.Status = renditions.Any(r => r.Status == RenditionStatus.Ready)
                    ? RenditionStatus.Ready
                    : RenditionStatus.Failed;

                if (video.Status == RenditionStatus.Failed)
                {
                    video.ErrorMessage = "All renditions failed to encode; see server logs.";
                }
            }
            catch (Exception ex)
            {
                video.Status = RenditionStatus.Failed;
                video.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Processing failed for video {VideoId}", videoId);
            }
        }
    }
}
