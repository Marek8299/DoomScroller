using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace DoomScroller.Api.Data;

/// <summary>
/// Loads appsettings.json (+ optional appsettings.{ASPNETCORE_ENVIRONMENT}.json and env
/// vars) the same way Program.cs does, so `dotnet ef migrations add`/`database update`
/// see the same connection info the running app would - without needing to spin up the
/// whole host. Used automatically by the `dotnet ef` CLI when it finds an
/// IDesignTimeDbContextFactory&lt;T&gt; for the --context you asked for.
/// </summary>
internal static class DesignTimeConfig
{
    public static IConfiguration Load()
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
        return new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();
    }
}

public class SqliteDoomScrollerDbContextFactory : IDesignTimeDbContextFactory<SqliteDoomScrollerDbContext>
{
    public SqliteDoomScrollerDbContext CreateDbContext(string[] args)
    {
        var configuration = DesignTimeConfig.Load();
        var connectionString = DatabaseConfiguration.GetSqliteConnectionString(configuration, Directory.GetCurrentDirectory());

        var optionsBuilder = new DbContextOptionsBuilder<SqliteDoomScrollerDbContext>();
        optionsBuilder.UseSqlite(connectionString, sqlite =>
            sqlite.MigrationsAssembly(typeof(SqliteDoomScrollerDbContext).Assembly.FullName)
                  .MigrationsHistoryTable("__EFMigrationsHistory"));

        return new SqliteDoomScrollerDbContext(optionsBuilder.Options);
    }
}

public class MySqlDoomScrollerDbContextFactory : IDesignTimeDbContextFactory<MySqlDoomScrollerDbContext>
{
    public MySqlDoomScrollerDbContext CreateDbContext(string[] args)
    {
        var configuration = DesignTimeConfig.Load();
        var connectionString = DatabaseConfiguration.GetMySqlConnectionString(configuration);
        var serverVersion = DatabaseConfiguration.GetMySqlServerVersion(configuration, connectionString);

        var optionsBuilder = new DbContextOptionsBuilder<MySqlDoomScrollerDbContext>();
        optionsBuilder.UseMySql(connectionString, serverVersion, mysql =>
            mysql.MigrationsAssembly(typeof(MySqlDoomScrollerDbContext).Assembly.FullName)
                 .MigrationsHistoryTable("__EFMigrationsHistory"));

        return new MySqlDoomScrollerDbContext(optionsBuilder.Options);
    }
}
