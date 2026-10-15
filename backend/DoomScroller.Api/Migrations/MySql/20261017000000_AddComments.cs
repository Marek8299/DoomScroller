using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.MySql
{
    /// <inheritdoc />
    public partial class AddComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VideoComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false),
                    VideoId = table.Column<Guid>(type: "char(36)", nullable: false),
                    AuthorId = table.Column<Guid>(type: "char(36)", nullable: false),
                    Text = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VideoComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VideoComments_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VideoComments_Videos_VideoId",
                        column: x => x.VideoId,
                        principalTable: "Videos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_VideoComments_AuthorId",
                table: "VideoComments",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_VideoComments_VideoId_CreatedAtUtc",
                table: "VideoComments",
                columns: new[] { "VideoId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VideoComments");
        }
    }
}
