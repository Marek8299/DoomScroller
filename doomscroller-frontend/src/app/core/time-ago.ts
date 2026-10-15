/** "just now", "5m ago", "3h ago", "2d ago", then a plain date once it's a week old. */
export function timeAgo(isoTimestamp: string, now: number = Date.now()): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.floor((now - then) / 1000)); // clock skew can make it negative: call that "now"
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;

  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
