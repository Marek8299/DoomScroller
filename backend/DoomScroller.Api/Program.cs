using DoomScroller.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

builder.Services.AddSingleton<IVideoRepository, InMemoryVideoRepository>();
builder.Services.AddSingleton<IVideoProcessingQueue, VideoProcessingQueue>();
builder.Services.AddSingleton<IFfmpegService, FfmpegService>();
builder.Services.AddHostedService<VideoProcessingWorker>();

var app = builder.Build();

// Make sure the storage folders exist before anything tries to write into them.
var storageRoot = Path.Combine(app.Environment.ContentRootPath, "Storage");
Directory.CreateDirectory(Path.Combine(storageRoot, "uploads"));
var mediaDir = Path.Combine(storageRoot, "media");
Directory.CreateDirectory(mediaDir);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
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
