namespace DoomScroller.Api.Services;

public interface IMediaFileCleaner
{
    /// <summary>Best-effort delete. Never throws for a missing/locked file, and refuses anything outside the Storage folder.</summary>
    void DeleteFiles(IEnumerable<string?> paths);
}

/// <summary>
/// Removes uploaded originals and encoded renditions from disk. It only ever touches files under
/// the app's Storage folder, so a bad path in the database can't be turned into deleting
/// something elsewhere on the machine.
/// </summary>
public class MediaFileCleaner : IMediaFileCleaner
{
    private readonly string _storageRoot;
    private readonly StringComparison _pathComparison;
    private readonly ILogger<MediaFileCleaner> _logger;

    public MediaFileCleaner(IWebHostEnvironment env, ILogger<MediaFileCleaner> logger)
    {
        _logger = logger;
        _storageRoot = Path.GetFullPath(Path.Combine(env.ContentRootPath, "Storage")) + Path.DirectorySeparatorChar;
        _pathComparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
    }

    public void DeleteFiles(IEnumerable<string?> paths)
    {
        foreach (var path in paths)
        {
            if (string.IsNullOrWhiteSpace(path)) continue;

            var full = Path.GetFullPath(path);
            if (!full.StartsWith(_storageRoot, _pathComparison))
            {
                _logger.LogWarning("Refusing to delete {Path}: it is outside the Storage folder", full);
                continue;
            }

            try
            {
                File.Delete(full); // no error if it's already gone
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // The database row is already gone, so a leftover file is harmless clutter, not a broken video.
                _logger.LogWarning(ex, "Could not delete {Path}", full);
            }
        }
    }
}
