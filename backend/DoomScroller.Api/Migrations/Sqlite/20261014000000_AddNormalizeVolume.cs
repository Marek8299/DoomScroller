using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DoomScroller.Api.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class AddNormalizeVolume : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NormalizeVolume",
                table: "Videos",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NormalizeVolume",
                table: "Videos");
        }
    }
}
