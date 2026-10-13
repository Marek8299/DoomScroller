namespace DoomScroller.Api.Models;

/// <summary>
/// What an uploader provides. Everything about *how* the video is encoded is server
/// configuration (the "Conversion" section of appsettings.json), not user input.
/// </summary>
public class UploadVideoRequest
{
    public const int MaxTitleLength = 200;
    public const int MaxDescriptionLength = 2000;

    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
}
