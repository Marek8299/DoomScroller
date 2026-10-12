using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Videos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    OriginalFileName = table.Column<string>(type: "TEXT", maxLength: 260, nullable: false),
                    UploadedAtUtc = table.Column<DateTimeOffset>(type: "INTEGER", nullable: false),
                    SourceFilePath = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    OptionsPreset = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    OptionsContainer = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    OptionsForceCopyAudio = table.Column<bool>(type: "INTEGER", nullable: false),
                    OptionsResolutionTargets = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ProbeWidth = table.Column<int>(type: "INTEGER", nullable: true),
                    ProbeHeight = table.Column<int>(type: "INTEGER", nullable: true),
                    ProbeDurationSeconds = table.Column<double>(type: "REAL", nullable: true),
                    ProbeVideoCodec = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    ProbeAudioCodec = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Videos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VideoRenditions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    VideoId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Height = table.Column<int>(type: "INTEGER", nullable: false),
                    IsOriginalResolution = table.Column<bool>(type: "INTEGER", nullable: false),
                    Container = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    VideoCodec = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    AudioCodec = table.Column<string>(type: "TEXT", maxLength: 30, nullable: true),
                    AudioWasCopied = table.Column<bool>(type: "INTEGER", nullable: false),
                    UsedHardwareEncoder = table.Column<bool>(type: "INTEGER", nullable: false),
                    FilePath = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: false),
                    SizeBytes = table.Column<long>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    ErrorMessage = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VideoRenditions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VideoRenditions_Videos_VideoId",
                        column: x => x.VideoId,
                        principalTable: "Videos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Videos_Status",
                table: "Videos",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_UploadedAtUtc",
                table: "Videos",
                column: "UploadedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_VideoRenditions_VideoId",
                table: "VideoRenditions",
                column: "VideoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "VideoRenditions");
            migrationBuilder.DropTable(name: "Videos");
        }
    }
}
