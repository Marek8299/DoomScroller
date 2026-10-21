namespace DoomScroller.Api.Services;

/// <summary>Where the app keeps files on disk. One place, so folders aren't spelled out in half a dozen others.</summary>
public sealed class StoragePaths
{
    public StoragePaths(IWebHostEnvironment env)
    {
        Root = Path.Combine(env.ContentRootPath, "Storage");
    }

    public string Root { get; }
    public string Uploads => Path.Combine(Root, "uploads"); // original uploaded videos
    public string Media => Path.Combine(Root, "media");     // encoded renditions, served at /media
    public string Thumbs => Path.Combine(Root, "thumbs");   // video preview images, served at /thumbs
    public string Avatars => Path.Combine(Root, "avatars"); // profile pictures, served at /avatars
    public string Temp => Path.Combine(Root, "tmp");        // short-lived scratch files

    public void EnsureCreated()
    {
        foreach (var dir in new[] { Uploads, Media, Thumbs, Avatars, Temp })
        {
            Directory.CreateDirectory(dir);
        }
    }
}
