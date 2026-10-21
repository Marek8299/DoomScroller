using System.Threading.RateLimiting;
using DoomScroller.Api.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;

namespace DoomScroller.Api.Auth;

public static class AuthServiceCollectionExtensions
{
    public const string AuthRateLimitPolicy = "auth";
    public const string CommentsRateLimitPolicy = "comments";
    public const string UploadsRateLimitPolicy = "uploads";

    /// <summary>
    /// Cookie authentication for the SPA: an HttpOnly cookie (not reachable from JavaScript, unlike a
    /// token in localStorage), SameSite=Lax so other sites can't make the browser send it on
    /// cross-site POSTs, and 401/403 status codes instead of login redirects (this is an API).
    /// Also registers the password hasher and rate limits (per IP for login/register, per user for comments).
    /// </summary>
    public static IServiceCollection AddDoomScrollerAuth(this IServiceCollection services)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "doomscroller.auth";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                // SameAsRequest = Secure whenever the request itself arrived over HTTPS. Behind a
                // TLS-terminating proxy, forward the original scheme (UseForwardedHeaders) so this works.
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromDays(14);
                options.SlidingExpiration = true;

                options.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        services.AddAuthorization();
        services.AddSingleton<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitPolicy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

            // Per signed-in user (so one account can't flood a video, and users behind one shared IP
            // don't throttle each other). Needs authentication to run BEFORE the rate limiter.
            options.AddPolicy(CommentsRateLimitPolicy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    httpContext.User.GetUserId()?.ToString()
                        ?? httpContext.Connection.RemoteIpAddress?.ToString()
                        ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

            // Profile-picture uploads each start an image conversion, so they get a tighter per-user limit.
            options.AddPolicy(UploadsRateLimitPolicy, httpContext =>
                RateLimitPartition.GetFixedWindowLimiter(
                    httpContext.User.GetUserId()?.ToString()
                        ?? httpContext.Connection.RemoteIpAddress?.ToString()
                        ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));
        });

        return services;
    }
}
