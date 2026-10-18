using DoomScroller.Api.Models;
using DoomScroller.Api.Services;

namespace DoomScroller.Api.Contracts;

public static class VideoMapper
{
    /// <summary>
    /// Maps a video for a given viewer. Only the author sees internal details: error messages and
    /// renditions that aren't ready (their own queued/failed uploads).
    /// </summary>
    public static VideoDto ToDto(VideoItem video, Guid? viewerId, LikeInfo? likes = null, int commentCount = 0)
    {
        var isOwner = viewerId is not null && video.AuthorId == viewerId;

        var renditions = video.Renditions
            .Where(r => isOwner || r.Status == RenditionStatus.Ready)
            .OrderByDescending(r => r.Height)
            .Select(r => new VideoRenditionDto(
                r.Id, r.Height, r.IsOriginalResolution, r.Container, r.VideoCodec, r.AudioCodec,
                r.SizeBytes, r.Status, r.Url))
            .ToList();

        return new VideoDto(
            video.Id,
            video.Title,
            video.Description,
            video.UploadedAtUtc,
            video.Status,
            isOwner ? video.ErrorMessage : null,
            video.Probe is null ? null : new ProbeDto(video.Probe.Width, video.Probe.Height, video.Probe.DurationSeconds),
            video.Author is null ? null : new AuthorDto(video.Author.Username),
            renditions,
            likes?.Count ?? 0,
            likes?.LikedByViewer ?? false,
            commentCount,
            isOwner);
    }
}
