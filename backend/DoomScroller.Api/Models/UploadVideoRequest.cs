namespace DoomScroller.Api.Models;

/// <summary>
/// What an uploader provides. Everything about *how* the video is encoded is server
/// configuration (the "Conversion" section of appsettings.json), not user input.
/// </summary>
public class UploadVideoRequest
{
    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }

    /// <summary>Loudness-normalise the audio. An artistic choice, so it belongs to the uploader.</summary>
    public bool NormalizeVolume { get; set; }
}
