using DoomScroller.Api.Data;
using DoomScroller.Api.Models;
using DoomScroller.Api.Options;
using DoomScroller.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        // Enums go over the wire as names ("WebOptimized", "Mp4"), not numbers.
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddOpenApi();

// Allow the Angular dev server (ng serve, default port 4200) to call this API.
const string CorsPolicy = "DoomScrollerFrontend";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// --- Database: SQLite or MySQL, picked by Database:Provider (see appsettings.json) ---
// Since EF Core 9, Migrate() throws if the model differs from the last migration's snapshot.
// The initial migrations in this repo were written by hand, so that check is switched off
// (PendingModelChangesWarning) to avoid a startup crash over snapshot cosmetics. Once you've
// regenerated them for real (`make migrations-sqlite` / `make migrations-mysql`), delete the
// two ConfigureWarnings(...) calls below to get the strict check back.
var dbProvider = DatabaseConfiguration.GetProvider(builder.Configuration);

switch (dbProvider)
{
    case DatabaseProvider.MySql:
        var mysqlConnectionString = DatabaseConfiguration.GetMySqlConnectionString(builder.Configuration);
        var mysqlServerVersion = DatabaseConfiguration.GetMySqlServerVersion(builder.Configuration, mysqlConnectionString);

        builder.Services.AddDbContext<MySqlDoomScrollerDbContext>(options =>
            options.UseMySql(mysqlConnectionString, mysqlServerVersion)
                   .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));

        // Everything else (repository, worker) depends on the abstract base type, so it
        // doesn't care which provider is actually active.
        builder.Services.AddScoped<DoomScrollerDbContext>(sp => sp.GetRequiredService<MySqlDoomScrollerDbContext>());
        break;

    case DatabaseProvider.Sqlite:
    default:
        var sqliteConnectionString = DatabaseConfiguration.GetSqliteConnectionString(builder.Configuration, builder.Environment.ContentRootPath);

        builder.Services.AddDbContext<SqliteDoomScrollerDbContext>(options =>
            options.UseSqlite(sqliteConnectionString)
                   .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));

        builder.Services.AddScoped<DoomScrollerDbContext>(sp => sp.GetRequiredService<SqliteDoomScrollerDbContext>());
        break;
}

builder.Services.AddScoped<IVideoRepository, EfVideoRepository>();
builder.Services.AddSingleton<IVideoProcessingQueue, VideoProcessingQueue>();
builder.Services.AddSingleton<IFfmpegService, FfmpegService>();
builder.Services.AddSingleton<IVideoFingerprintService, VideoFingerprintService>();

// --- Server-side configuration (appsettings.json / env vars) ---
builder.Services.Configure<FfmpegOptions>(builder.Configuration.GetSection("Ffmpeg"));

// How uploads get encoded is an admin decision, not a user one: the "Conversion" section.
// Invalid values (unknown preset, malformed resolution list) stop the app at startup.
builder.Services.AddOptions<ConversionOptions>()
    .Bind(builder.Configuration.GetSection("Conversion"))
    .Validate(o => o.IsResolutionTargetsValid(),
        "Conversion:ResolutionTargets must be \"original\" or a comma-separated list of heights, e.g. \"480,720,1080\".")
    .ValidateOnStart();
builder.Services.AddHostedService<VideoProcessingWorker>();

var app = builder.Build();

// Make sure the storage folders exist before anything tries to write into them.
var storageRoot = Path.Combine(app.Environment.ContentRootPath, "Storage");
Directory.CreateDirectory(Path.Combine(storageRoot, "uploads"));
var mediaDir = Path.Combine(storageRoot, "media");
Directory.CreateDirectory(mediaDir);

// Apply any pending migrations for whichever provider is active. Fine for a small app;
// for a real deployment you'd more likely run `dotnet ef database update` as a separate
// release step instead of migrating on every start.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DoomScrollerDbContext>();
    db.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); // /openapi/v1.json
}

app.UseCors(CorsPolicy);

// Serve transcoded renditions straight off disk at /media/<renditionId>.<ext>
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(mediaDir),
    RequestPath = "/media"
});

app.MapControllers();

app.Run();
