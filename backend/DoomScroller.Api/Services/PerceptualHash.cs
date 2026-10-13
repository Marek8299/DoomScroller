namespace DoomScroller.Api.Services;

/// <summary>
/// Classic DCT perceptual hash (pHash) of a single frame. Pure maths, no I/O, so it's easy to unit test.
///
/// Input is a 32x32 grayscale frame. We take a 2D DCT, keep the 8x8 block of lowest
/// frequencies (the coarse structure of the image, which survives re-encoding, scaling and
/// mild colour changes) and set one bit per coefficient: 1 if it is above the median of the
/// AC coefficients. Visually similar frames end up with hashes that differ in only a few bits.
/// </summary>
public static class PerceptualHash
{
    public const int FrameSize = 32;
    public const int FrameBytes = FrameSize * FrameSize;
    private const int HashDim = 8;

    // Cos[u, x] = cos((2x + 1) * u * PI / (2 * FrameSize)), only for the 8 frequencies we keep.
    private static readonly double[,] Cos = BuildCosTable();

    public static ulong HashFrame(ReadOnlySpan<byte> gray)
    {
        if (gray.Length != FrameBytes)
        {
            throw new ArgumentException($"Expected {FrameBytes} grayscale bytes ({FrameSize}x{FrameSize}), got {gray.Length}.", nameof(gray));
        }

        // Separable DCT: first along rows (x -> u) ...
        Span<double> rowDct = stackalloc double[FrameSize * HashDim]; // [y * HashDim + u]
        for (var y = 0; y < FrameSize; y++)
        {
            for (var u = 0; u < HashDim; u++)
            {
                double sum = 0;
                for (var x = 0; x < FrameSize; x++)
                {
                    sum += gray[y * FrameSize + x] * Cos[u, x];
                }
                rowDct[y * HashDim + u] = sum;
            }
        }

        // ... then along columns (y -> v).
        Span<double> coeffs = stackalloc double[HashDim * HashDim]; // [v * HashDim + u]
        for (var v = 0; v < HashDim; v++)
        {
            for (var u = 0; u < HashDim; u++)
            {
                double sum = 0;
                for (var y = 0; y < FrameSize; y++)
                {
                    sum += rowDct[y * HashDim + u] * Cos[v, y];
                }
                coeffs[v * HashDim + u] = sum;
            }
        }

        // Median of the 63 AC coefficients (the DC term is just average brightness and would skew it).
        Span<double> ac = stackalloc double[HashDim * HashDim - 1];
        coeffs[1..].CopyTo(ac);
        ac.Sort();
        var median = ac[ac.Length / 2];

        ulong hash = 0;
        for (var i = 0; i < coeffs.Length; i++)
        {
            if (coeffs[i] > median) hash |= 1UL << i;
        }
        return hash;
    }

    /// <summary>Concatenates per-frame hashes as fixed-width lowercase hex (16 chars per frame).</summary>
    public static string ToHex(IEnumerable<ulong> frameHashes) =>
        string.Concat(frameHashes.Select(h => h.ToString("x16")));

    private static double[,] BuildCosTable()
    {
        var table = new double[HashDim, FrameSize];
        for (var u = 0; u < HashDim; u++)
        {
            for (var x = 0; x < FrameSize; x++)
            {
                table[u, x] = Math.Cos((2 * x + 1) * u * Math.PI / (2 * FrameSize));
            }
        }
        return table;
    }
}
