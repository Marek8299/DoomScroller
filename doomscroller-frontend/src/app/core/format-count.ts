/** Compact like counts for the UI: 999, 1.2K, 15K, 3.4M. Rounds down so a count never overstates. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return String(Math.floor(n));

  const [divisor, suffix] = n >= 1_000_000 ? [1_000_000, 'M'] : [1000, 'K'];
  const scaled = Math.floor((n / divisor) * 10) / 10; // one decimal, truncated
  return `${scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
}
