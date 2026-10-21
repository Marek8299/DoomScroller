using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DoomScroller.Api.Controllers;

/// <summary>Things you can change about your own profile.</summary>
[ApiController]
[Route("api/me")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly IAvatarService _avatars;
    private readonly IMediaFileCleaner _files;
    private readonly StoragePaths _storage;
    private readonly ILogger<MeController> _logger;

    public MeController(
        IUserRepository users,
        IAvatarService avatars,
        IMediaFileCleaner files,
        StoragePaths storage,
        ILogger<MeController> logger)
    {
        _users = users;
        _avatars = avatars;
        _files = files;
        _storage = storage;
        _logger = logger;
    }

    /// <summary>Update the bio (a blank bio clears it) and, if given, whether your likes are public.</summary>
    [HttpPatch("profile")]
    public async Task<ActionResult<ProfileEditDto>> UpdateProfile(UpdateProfileRequest request, CancellationToken ct)
    {
        var (bio, error) = ProfileRules.CleanBio(request.Bio);
        if (error is not null) return BadRequest(error);

        var user = await CurrentUserAsync(ct);
        if (user is null) return Unauthorized();

        user.Bio = bio;
        if (request.LikesPublic is { } likesPublic) user.LikesPublic = likesPublic;
        await _users.SaveChangesAsync(ct);

        return Ok(ToDto(user));
    }

    /// <summary>Replace your profile picture. JPEG, PNG or WebP up to 5 MB; it's cropped to a square.</summary>
    [HttpPut("avatar")]
    [RequestSizeLimit(AvatarService.MaxUploadBytes + 64 * 1024)] // the file, plus multipart overhead
    [EnableRateLimiting(AuthServiceCollectionExtensions.UploadsRateLimitPolicy)]
    public async Task<ActionResult<ProfileEditDto>> UploadAvatar(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest("No file uploaded.");
        if (file.Length > AvatarService.MaxUploadBytes) return BadRequest("That image is too large (5 MB maximum).");

        var user = await CurrentUserAsync(ct);
        if (user is null) return Unauthorized();

        string newFile;
        try
        {
            await using var stream = file.OpenReadStream();
            newFile = await _avatars.SaveAsync(stream, ct);
        }
        catch (InvalidImageException ex)
        {
            return BadRequest(ex.Message);
        }

        var oldFile = user.AvatarFileName;
        user.AvatarFileName = newFile;
        try
        {
            await _users.SaveChangesAsync(ct);
        }
        catch
        {
            _files.DeleteFiles(new[] { Path.Combine(_storage.Avatars, newFile) }); // don't orphan the new picture
            throw;
        }

        if (oldFile is not null) _files.DeleteFiles(new[] { Path.Combine(_storage.Avatars, oldFile) });
        _logger.LogInformation("User {UserId} changed their profile picture", user.Id);
        return Ok(ToDto(user));
    }

    [HttpDelete("avatar")]
    public async Task<ActionResult<ProfileEditDto>> RemoveAvatar(CancellationToken ct)
    {
        var user = await CurrentUserAsync(ct);
        if (user is null) return Unauthorized();

        var oldFile = user.AvatarFileName;
        user.AvatarFileName = null;
        await _users.SaveChangesAsync(ct);

        if (oldFile is not null) _files.DeleteFiles(new[] { Path.Combine(_storage.Avatars, oldFile) });
        return Ok(ToDto(user));
    }

    private async Task<AppUser?> CurrentUserAsync(CancellationToken ct)
    {
        var id = User.GetUserId();
        return id is null ? null : await _users.GetAsync(id.Value, ct);
    }

    private static ProfileEditDto ToDto(AppUser user) =>
        new(user.Bio, MediaUrls.Avatar(user.AvatarFileName), user.LikesPublic);
}
