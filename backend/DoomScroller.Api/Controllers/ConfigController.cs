using DoomScroller.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace DoomScroller.Api.Controllers;

/// <summary>
/// Lets the Angular app build its upload form from server-defined truth instead of
/// hard-coding preset names, so backend and frontend can't drift out of sync.
/// </summary>
[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    [HttpGet("options")]
    public ActionResult<object> GetOptions()
    {
        return Ok(new
        {
            appName = "DoomScroller",
            presets = new[]
            {
                new { value = nameof(EncodingPreset.LowestSize), label = "Lowest size (AV1 + AAC)" },
                new { value = nameof(EncodingPreset.Conservative), label = "Conservative (HEVC, HW if available + AAC)" },
                new { value = nameof(EncodingPreset.WebOptimized), label = "Web optimised (H.264 + AAC)" }
            },
            containers = new[]
            {
                new { value = nameof(ContainerFormat.Mp4), label = "MP4" },
                new { value = nameof(ContainerFormat.Mkv), label = "MKV" }
            },
            resolutionPresets = new[]
            {
                new { value = "original", label = "Original only" },
                new { value = "480,720,1080,2160", label = "480p / 720p / 1080p / 2160p (skips anything above source)" }
            }
        });
    }
}
