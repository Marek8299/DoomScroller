import { describe, expect, it } from 'vitest';
import { timeAgo } from './time-ago';

const now = Date.parse('2026-10-15T12:00:00Z');
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe('timeAgo', () => {
  it('says "just now" for under a minute, including timestamps slightly in the future', () => {
    expect(timeAgo(ago(5), now)).toBe('just now');
    expect(timeAgo(ago(-30), now)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(60), now)).toBe('1m ago');
    expect(timeAgo(ago(59 * 60), now)).toBe('59m ago');
    expect(timeAgo(ago(3 * 3600), now)).toBe('3h ago');
    expect(timeAgo(ago(2 * 86_400), now)).toBe('2d ago');
  });

  it('switches to a date after a week, adding the year only for other years', () => {
    expect(timeAgo('2026-10-01T12:00:00Z', now)).toBe('Oct 1');
    expect(timeAgo('2025-03-09T12:00:00Z', now)).toBe('Mar 9, 2025');
  });

  it('returns nothing for an unparseable timestamp', () => {
    expect(timeAgo('not a date', now)).toBe('');
  });
});
