using DoomScroller.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DoomScroller.Api.Data;

/// <summary>
/// Shared entity model for both supported providers. EF Core migrations are tied to a
/// concrete DbContext type, so - per Microsoft's own guidance for supporting multiple
/// providers with one model - there's a thin subclass per provider below
/// (<see cref="SqliteDoomScrollerDbContext"/>, <see cref="MySqlDoomScrollerDbContext"/>),
/// each with its own migrations folder/history. Only one is ever registered at runtime,
/// picked by the Database:Provider setting (see Program.cs).
/// </summary>
public abstract class DoomScrollerDbContext : DbContext
{
    protected DoomScrollerDbContext(DbContextOptions options) : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<VideoItem> Videos => Set<VideoItem>();
    public DbSet<VideoLike> Likes => Set<VideoLike>();
    public DbSet<VideoRendition> Renditions => Set<VideoRendition>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(user =>
        {
            user.ToTable("Users");
            user.HasKey(u => u.Id);
            user.Property(u => u.Id).ValueGeneratedNever();

            user.Property(u => u.Username).HasMaxLength(30).IsRequired();
            user.Property(u => u.NormalizedUsername).HasMaxLength(30).IsRequired();
            user.Property(u => u.PasswordHash).HasMaxLength(256).IsRequired();

            // Case-insensitive uniqueness: "Marek" and "marek" are the same account name.
            user.HasIndex(u => u.NormalizedUsername).IsUnique();
        });

        modelBuilder.Entity<VideoItem>(video =>
        {
            video.ToTable("Videos");
            video.HasKey(v => v.Id);
            // We always generate the id client-side (Guid.NewGuid() in the model default),
            // so tell EF not to expect the database to produce one.
            video.Property(v => v.Id).ValueGeneratedNever();

            video.Property(v => v.Title).HasMaxLength(200);
            video.Property(v => v.OriginalFileName).HasMaxLength(260).IsRequired();
            video.Property(v => v.SourceFilePath).HasMaxLength(1024).IsRequired();
            video.Property(v => v.Description).HasMaxLength(UploadVideoRequest.MaxDescriptionLength);
            video.Property(v => v.PerceptualHash).HasMaxLength(256);
            video.Property(v => v.Status).HasConversion<string>().HasMaxLength(20);
            video.Property(v => v.ErrorMessage).HasMaxLength(2000);

            // ConversionOptions/VideoProbeResult are plain value objects, not separate
            // aggregates - OwnsOne keeps them as columns on the Videos table rather than
            // a joined table, while letting the rest of the app keep using video.Options.X.
            video.OwnsOne(v => v.Options, options =>
            {
                options.Property(o => o.Preset).HasConversion<string>().HasColumnName("OptionsPreset").HasMaxLength(20).IsRequired();
                options.Property(o => o.Container).HasConversion<string>().HasColumnName("OptionsContainer").HasMaxLength(10).IsRequired();
                options.Property(o => o.ForceCopyAudioIfSupported).HasColumnName("OptionsForceCopyAudio").IsRequired();
                options.Property(o => o.ResolutionTargets).HasColumnName("OptionsResolutionTargets").HasMaxLength(200).IsRequired();
            });

            video.OwnsOne(v => v.Probe, probe =>
            {
                probe.Property(p => p.Width).HasColumnName("ProbeWidth");
                probe.Property(p => p.Height).HasColumnName("ProbeHeight");
                probe.Property(p => p.DurationSeconds).HasColumnName("ProbeDurationSeconds");
                probe.Property(p => p.VideoCodec).HasColumnName("ProbeVideoCodec").HasMaxLength(50);
                probe.Property(p => p.AudioCodec).HasColumnName("ProbeAudioCodec").HasMaxLength(50);
            });

            // Optional only because videos predate accounts. Restrict: an author with videos can't be
            // deleted out from under them.
            video.HasOne(v => v.Author)
                 .WithMany()
                 .HasForeignKey(v => v.AuthorId)
                 .OnDelete(DeleteBehavior.Restrict);

            video.HasMany(v => v.Renditions)
                 .WithOne()
                 .HasForeignKey("VideoId")
                 .OnDelete(DeleteBehavior.Cascade);

            video.HasIndex(v => v.UploadedAtUtc);
            video.HasIndex(v => v.Status);
        });

        modelBuilder.Entity<VideoLike>(like =>
        {
            like.ToTable("VideoLikes");
            like.HasKey(l => new { l.VideoId, l.UserId }); // one like per user per video, enforced by the database

            // Likes are meaningless without either side, so they go away with the video or the user.
            like.HasOne<VideoItem>().WithMany().HasForeignKey(l => l.VideoId).OnDelete(DeleteBehavior.Cascade);
            like.HasOne<AppUser>().WithMany().HasForeignKey(l => l.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VideoRendition>(rendition =>
        {
            rendition.ToTable("VideoRenditions");
            rendition.HasKey(r => r.Id);
            rendition.Property(r => r.Id).ValueGeneratedNever();

            rendition.Property(r => r.Container).HasConversion<string>().HasMaxLength(10).IsRequired();
            rendition.Property(r => r.VideoCodec).HasMaxLength(30);
            rendition.Property(r => r.AudioCodec).HasMaxLength(30);
            rendition.Property(r => r.FilePath).HasMaxLength(1024).IsRequired();
            rendition.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
            rendition.Property(r => r.ErrorMessage).HasMaxLength(2000);

            // Computed, not real columns.
            rendition.Ignore(r => r.FileName);
            rendition.Ignore(r => r.Url);
        });
    }
}

/// <summary>Concrete context used when Database:Provider = "Sqlite". Migrations live under Migrations/Sqlite.</summary>
public class SqliteDoomScrollerDbContext : DoomScrollerDbContext
{
    public SqliteDoomScrollerDbContext(DbContextOptions<SqliteDoomScrollerDbContext> options) : base(options)
    {
    }

    /// <summary>
    /// SQLite's EF Core provider stores DateTimeOffset as TEXT and refuses to translate
    /// ORDER BY / comparisons on it ("SQLite does not support expressions of type
    /// 'DateTimeOffset' in ORDER BY clauses"). Storing UTC ticks as an INTEGER keeps the
    /// C# model unchanged and makes ordering work. All timestamps here are UTC
    /// (DateTimeOffset.UtcNow), so nothing is lost by dropping the offset.
    /// </summary>
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTimeOffset>()
            .HaveConversion<UtcTicksConverter>();
    }

    private sealed class UtcTicksConverter : ValueConverter<DateTimeOffset, long>
    {
        public UtcTicksConverter()
            : base(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero))
        {
        }
    }
}

/// <summary>Concrete context used when Database:Provider = "MySql". Migrations live under Migrations/MySql.</summary>
public class MySqlDoomScrollerDbContext : DoomScrollerDbContext
{
    public MySqlDoomScrollerDbContext(DbContextOptions<MySqlDoomScrollerDbContext> options) : base(options)
    {
    }
}
