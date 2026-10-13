using System.Globalization;
using System.Text.Json;

namespace DoomScroller.Api.Services;

/// <summary>Result of ffmpeg's loudnorm analysis pass over a source's audio.</summary>
public sealed record LoudnessMeasurement(
    double InputIntegrated, double InputTruePeak, double InputRange, double InputThreshold, double TargetOffset);

/// <summary>
/// EBU R128 loudness normalisation via ffmpeg's `loudnorm` filter, done in two passes: a
/// measuring pass over the source's audio, then an encode pass that applies a single linear gain
/// computed from that measurement (no pumping/compression, unlike one-pass dynamic mode).
/// Pure string/number handling, no I/O.
/// </summary>
public static class LoudnessNormalization
{
    /// <summary>Integrated loudness target. -16 LUFS is a common level for streaming/mobile playback.</summary>
    public const double TargetLufs = -16;
    public const double TruePeakDb = -1.5;
    public const double LoudnessRange = 11;

    private static string Targets =>
        $"I={Fmt(TargetLufs)}:TP={Fmt(TruePeakDb)}:LRA={Fmt(LoudnessRange)}";

    /// <summary>Filter for the measuring pass; prints a JSON report on stderr.</summary>
    public static string MeasureFilter => $"loudnorm={Targets}:print_format=json";

    /// <summary>
    /// Filter for the encode pass. With a measurement: precise linear normalisation. Without one
    /// (analysis failed or the audio is silent): ffmpeg's single-pass mode as a fallback.
    /// </summary>
    public static string BuildFilter(LoudnessMeasurement? m) => m is null
        ? $"loudnorm={Targets}"
        : $"loudnorm={Targets}" +
          $":measured_I={Fmt(m.InputIntegrated)}:measured_TP={Fmt(m.InputTruePeak)}" +
          $":measured_LRA={Fmt(m.InputRange)}:measured_thresh={Fmt(m.InputThreshold)}" +
          $":offset={Fmt(m.TargetOffset)}:linear=true";

    /// <summary>Extracts the JSON report loudnorm prints at the end of ffmpeg's stderr; null if absent or unusable (e.g. "-inf" for silence).</summary>
    public static LoudnessMeasurement? ParseMeasurement(string ffmpegStderr)
    {
        var start = ffmpegStderr.LastIndexOf('{');
        if (start < 0) return null;
        var end = ffmpegStderr.IndexOf('}', start);
        if (end < 0) return null;

        try
        {
            using var doc = JsonDocument.Parse(ffmpegStderr[start..(end + 1)]);
            var root = doc.RootElement;

            if (TryGet(root, "input_i", out var i) && TryGet(root, "input_tp", out var tp) &&
                TryGet(root, "input_lra", out var lra) && TryGet(root, "input_thresh", out var thresh) &&
                TryGet(root, "target_offset", out var offset))
            {
                return new LoudnessMeasurement(i, tp, lra, thresh, offset);
            }
        }
        catch (JsonException)
        {
            // fall through
        }

        return null;
    }

    private static bool TryGet(JsonElement root, string name, out double value)
    {
        value = 0;
        return root.TryGetProperty(name, out var el) &&
               el.ValueKind == JsonValueKind.String &&
               double.TryParse(el.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out value) &&
               double.IsFinite(value);
    }

    private static string Fmt(double v) => v.ToString("0.##", CultureInfo.InvariantCulture);
}
