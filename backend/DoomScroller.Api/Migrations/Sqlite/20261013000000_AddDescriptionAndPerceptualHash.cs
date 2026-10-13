using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class AddDescriptionAndPerceptualHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Videos",
                type: "TEXT",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PerceptualHash",
                table: "Videos",
                type: "TEXT",
                maxLength: 256,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "PerceptualHash",
                table: "Videos");
        }
    }
}
