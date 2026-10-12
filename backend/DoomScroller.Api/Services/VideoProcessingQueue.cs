using System.Threading.Channels;
using DoomScroller.Api.Models;
using Microsoft.Extensions.DependencyInjection;

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
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IFfmpegService _ffmpeg;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<VideoProcessingWorker> _logger;

    public VideoProcessingWorker(
        IVideoProcessingQueue queue,
        IServiceScopeFactory scopeFactory,
        IFfmpegService ffmpeg,
        IWebHostEnvironment env,
        ILogger<VideoProcessingWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _ffmpeg = ffmpeg;
        _env = env;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var videoId in _queue.ReadAllAsync(stoppingToken))
        {
            // IVideoRepository wraps a DbContext, which isn't thread-safe and isn't meant
            // to outlive a single unit of work - so each queued video gets its own scope,
            // the same way a single HTTP request would.
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IVideoRepository>();

            var video = await repository.GetAsync(videoId, stoppingToken);
            if (video is null) continue;

            try
            {
                video.Status = RenditionStatus.Processing;
                await repository.SaveChangesAsync(stoppingToken);

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

            await repository.SaveChangesAsync(stoppingToken);
        }
    }
}
