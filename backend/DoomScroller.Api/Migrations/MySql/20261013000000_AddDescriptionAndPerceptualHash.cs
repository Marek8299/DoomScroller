using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.MySql
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
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PerceptualHash",
                table: "Videos",
                type: "varchar(256)",
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
