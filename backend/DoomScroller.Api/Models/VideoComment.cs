namespace DoomScroller.Api.Models;

/// <summary>A flat (non-threaded) comment on a finished video.</summary>
public class VideoComment
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid VideoId { get; init; }
    public Guid AuthorId { get; init; }

    /// <summary>Loaded when listing comments; not set on freshly created ones.</summary>
    public AppUser? Author { get; set; }

    public string Text { get; init; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
