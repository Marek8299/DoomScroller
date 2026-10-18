namespace DoomScroller.Api.Services;

/// <summary>
/// A video was deleted while someone else (typically the background worker) was still holding it.
/// A domain-level signal so callers don't need to know about EF's concurrency exceptions.
/// </summary>
public class VideoGoneException : Exception
{
    public VideoGoneException(Exception? inner = null) : base("The video no longer exists.", inner)
    {
    }
}
