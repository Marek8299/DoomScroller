using System.Security.Claims;
using DoomScroller.Api.Auth;
using DoomScroller.Api.Contracts;
using DoomScroller.Api.Models;
using DoomScroller.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DoomScroller.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    // Verified against when the username doesn't exist, so "no such user" and "wrong password"
    // take the same time and can't be told apart (user enumeration via timing).
    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<AppUser>().HashPassword(new AppUser(), "not-a-real-password"));

    private const string InvalidCredentials = "Invalid username or password.";

    private readonly IUserRepository _users;
    private readonly IPasswordHasher<AppUser> _hasher;

    public AuthController(IUserRepository users, IPasswordHasher<AppUser> hasher)
    {
        _users = users;
        _hasher = hasher;
    }

    [HttpPost("register")]
    [EnableRateLimiting(AuthServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<ActionResult<CurrentUserDto>> Register(RegisterRequest request, CancellationToken ct)
    {
        var error = CredentialRules.Validate(request.Username, request.Password);
        if (error is not null) return BadRequest(error);

        var username = request.Username!.Trim();
        var user = new AppUser
        {
            Username = username,
            NormalizedUsername = CredentialRules.Normalize(username)
        };
        user.PasswordHash = _hasher.HashPassword(user, request.Password!);

        if (!await _users.TryAddAsync(user, ct))
        {
            return Conflict("That username is already taken.");
        }

        await SignInAsync(user);
        return Ok(new CurrentUserDto(user.Id, user.Username));
    }

    [HttpPost("login")]
    [EnableRateLimiting(AuthServiceCollectionExtensions.AuthRateLimitPolicy)]
    public async Task<ActionResult<CurrentUserDto>> Login(LoginRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password)
            || request.Password.Length > CredentialRules.MaxPasswordLength)
        {
            return Unauthorized(InvalidCredentials);
        }

        var user = await _users.FindByUsernameAsync(request.Username, ct);
        if (user is null)
        {
            _hasher.VerifyHashedPassword(new AppUser(), DummyHash.Value, request.Password);
            return Unauthorized(InvalidCredentials);
        }

        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            return Unauthorized(InvalidCredentials);
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            // The hasher's defaults got stronger since this hash was made: upgrade it transparently.
            user.PasswordHash = _hasher.HashPassword(user, request.Password);
            await _users.SaveChangesAsync(ct);
        }

        await SignInAsync(user);
        return Ok(new CurrentUserDto(user.Id, user.Username));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    /// <summary>Who am I? 401 when not signed in. The SPA calls this on startup.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
    {
        var userId = User.GetUserId();
        var user = userId is null ? null : await _users.GetAsync(userId.Value, ct);
        if (user is null)
        {
            // Cookie outlived the account (or the database was reset).
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized();
        }

        return Ok(new CurrentUserDto(user.Id, user.Username));
    }

    private Task SignInAsync(AppUser user)
    {
        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username)
            },
            CookieAuthenticationDefaults.AuthenticationScheme);

        return HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });
    }
}
