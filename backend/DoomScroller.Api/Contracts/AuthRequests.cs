namespace DoomScroller.Api.Contracts;

public record RegisterRequest(string? Username, string? Password);

public record LoginRequest(string? Username, string? Password);

public record CreateCommentRequest(string? Text);

/// <summary>Both fields are applied as given: a blank description clears it, a blank title is rejected.</summary>
public record UpdateVideoRequest(string? Title, string? Description);
