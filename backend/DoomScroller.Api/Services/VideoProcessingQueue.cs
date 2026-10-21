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
    private readonly IVideoFingerprintService _fingerprint;
    private readonly IMediaFileCleaner _cleaner;
    private readonly StoragePaths _storage;
    private readonly IThumbnailService _thumbnails;
    private readonly ILogger<VideoProcessingWorker> _logger;

    public VideoProcessingWorker(
        IVideoProcessingQueue queue,
        IServiceScopeFactory scopeFactory,
        IFfmpegService ffmpeg,
        IVideoFingerprintService fingerprint,
        IMediaFileCleaner cleaner,
        IThumbnailService thumbnails,
        StoragePaths storage,
        ILogger<VideoProcessingWorker> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _ffmpeg = ffmpeg;
        _fingerprint = fingerprint;
        _cleaner = cleaner;
        _storage = storage;
        _thumbnails = thumbnails;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var videoId in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(videoId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break; // shutting down
            }
            catch (Exception ex)
            {
                // One bad video must never take the whole app down (an unhandled exception here
                // would stop the host by default): log it and move on to the next one.
                _logger.LogError(ex, "Unexpected error while processing video {VideoId}", videoId);
            }
        }
    }

    private async Task ProcessAsync(Guid videoId, CancellationToken ct)
    {
        // IVideoRepository wraps a DbContext, which isn't thread-safe and isn't meant
        // to outlive a single unit of work - so each queued video gets its own scope,
        // the same way a single HTTP request would.
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IVideoRepository>();

        var video = await repository.GetAsync(videoId, ct);
        if (video is null) return; // deleted while it was waiting in the queue

        var sourcePath = video.SourceFilePath;
        var producedFiles = new List<string>();

        try
        {
            video.Status = RenditionStatus.Processing;
            await repository.SaveChangesAsync(ct);

            video.Probe = await _ffmpeg.ProbeAsync(video.SourceFilePath, ct);

            // A failed fingerprint must not fail the video itself - it just stays null.
            try
            {
                video.PerceptualHash = await _fingerprint.ComputePerceptualHashAsync(
                    video.SourceFilePath, video.Probe.DurationSeconds, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Could not compute perceptual hash for video {VideoId}", videoId);
            }

            // The preview image for the profile grid. Like the fingerprint, optional: no thumbnail never fails a video.
            try
            {
                video.ThumbnailFileName = await _thumbnails.CreateAsync(
                    video.Id, video.SourceFilePath, video.Probe.DurationSeconds, ct);
                producedFiles.Add(Path.Combine(_storage.Thumbs, video.ThumbnailFileName));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Could not create a thumbnail for video {VideoId}", videoId);
            }

            var mediaDir = _storage.Media;
            var renditions = await _ffmpeg.ConvertAllRenditionsAsync(
                video.SourceFilePath,
                video.Probe,
                video.Options,
                mediaDir,
                video.NormalizeVolume,
                ct: ct);

            producedFiles.AddRange(renditions.Select(r => r.FilePath));
            video.Renditions.AddRange(renditions);
            video.Status = renditions.Any(r => r.Status == RenditionStatus.Ready)
                ? RenditionStatus.Ready
                : RenditionStatus.Failed;

            if (video.Status == RenditionStatus.Failed)
            {
                video.ErrorMessage = "All renditions failed to encode; see server logs.";
            }
        }
        catch (VideoGoneException)
        {
            Discard(videoId, producedFiles, sourcePath);
            return;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            video.Status = RenditionStatus.Failed;
            video.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Processing failed for video {VideoId}", videoId);
        }

        try
        {
            await repository.SaveChangesAsync(ct);
        }
        catch (VideoGoneException)
        {
            // The owner deleted the video while it was encoding. The encode ran to the end (we don't
            // interrupt ffmpeg), so throw its output away instead of leaving it on disk forever.
            Discard(videoId, producedFiles, sourcePath);
        }
    }

    private void Discard(Guid videoId, IEnumerable<string> producedFiles, string sourcePath)
    {
        _logger.LogInformation("Video {VideoId} was deleted while it was being processed; discarding its files", videoId);
        _cleaner.DeleteFiles(producedFiles.Append(sourcePath));
    }
}
