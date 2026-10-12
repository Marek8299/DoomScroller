using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.MySql
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Videos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    Title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    OriginalFileName = table.Column<string>(type: "varchar(260)", maxLength: 260, nullable: false),
                    UploadedAtUtc = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false),
                    SourceFilePath = table.Column<string>(type: "varchar(1024)", maxLength: 1024, nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true),
                    OptionsPreset = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    OptionsContainer = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    OptionsForceCopyAudio = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    OptionsResolutionTargets = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    ProbeWidth = table.Column<int>(type: "int", nullable: true),
                    ProbeHeight = table.Column<int>(type: "int", nullable: true),
                    ProbeDurationSeconds = table.Column<double>(type: "double", nullable: true),
                    ProbeVideoCodec = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true),
                    ProbeAudioCodec = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Videos", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "VideoRenditions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    VideoId = table.Column<Guid>(type: "char(36)", nullable: false),
                    Height = table.Column<int>(type: "int", nullable: false),
                    IsOriginalResolution = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Container = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    VideoCodec = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    AudioCodec = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                    AudioWasCopied = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    UsedHardwareEncoder = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    FilePath = table.Column<string>(type: "varchar(1024)", maxLength: 1024, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    ErrorMessage = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
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
                })
                .Annotation("MySql:CharSet", "utf8mb4");

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
