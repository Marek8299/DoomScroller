using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DoomScroller.Api.Data;

public enum DatabaseProvider
{
    Sqlite,
    MySql
}

/// <summary>
/// Reads which database to use and how to connect to it. Config keys (appsettings.json,
/// or the equivalent DATABASE__PROVIDER / CONNECTIONSTRINGS__MYSQL env vars):
///
///   "Database": { "Provider": "Sqlite" | "MySql", "SqlitePath": "Storage/doomscroller.db" }
///   "ConnectionStrings": { "MySql": "Server=...;Database=...;User=...;Password=...;" }
///
/// SQLite only needs a file path (resolved relative to the content root if not absolute,
/// so it doesn't depend on the process's current working directory); MySQL needs a full
/// connection string since there's a server/user/password to describe.
/// </summary>
public static class DatabaseConfiguration
{
    public static DatabaseProvider GetProvider(IConfiguration configuration)
    {
        var raw = configuration["Database:Provider"];
        if (string.IsNullOrWhiteSpace(raw)) return DatabaseProvider.Sqlite;

        return raw.Trim().ToLowerInvariant() switch
        {
            "mysql" => DatabaseProvider.MySql,
            "sqlite" => DatabaseProvider.Sqlite,
            _ => throw new InvalidOperationException(
                $"Unknown Database:Provider '{raw}'. Expected \"Sqlite\" or \"MySql\".")
        };
    }

    public static string GetSqliteConnectionString(IConfiguration configuration, string contentRootPath)
    {
        var path = configuration["Database:SqlitePath"];
        if (string.IsNullOrWhiteSpace(path)) path = "Storage/doomscroller.db";

        if (!Path.IsPathRooted(path))
        {
            path = Path.Combine(contentRootPath, path);
        }

        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        return $"Data Source={path}";
    }

    public static string GetMySqlConnectionString(IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MySql");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:MySql must be set (appsettings.json or the CONNECTIONSTRINGS__MYSQL env var) when Database:Provider is \"MySql\".");
        }

        return connectionString;
    }

    /// <summary>
    /// The MySQL provider can auto-detect the server version by connecting, but that means
    /// `dotnet ef migrations add` needs a live MySQL server just to add a migration.
    /// Defaulting to a fixed, reasonably recent MySQL version avoids that; override with
    /// "Database:MySqlServerVersion" (e.g. "8.0.36" or "10.11.6-mariadb") if you're on
    /// something meaningfully different, or set it to "auto" to restore auto-detection.
    /// </summary>
    public static ServerVersion GetMySqlServerVersion(IConfiguration configuration, string connectionString)
    {
        var configured = configuration["Database:MySqlServerVersion"];

        if (string.IsNullOrWhiteSpace(configured))
        {
            return new MySqlServerVersion(new Version(8, 0, 36));
        }

        if (configured.Trim().Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            return ServerVersion.AutoDetect(connectionString);
        }

        return ServerVersion.Parse(configured);
    }
}
