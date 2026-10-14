import { describe, expect, it } from 'vitest';
import { formatCount } from './format-count';

describe('formatCount', () => {
  it('shows small numbers as they are', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(7)).toBe('7');
    expect(formatCount(999)).toBe('999');
  });

  it('abbreviates thousands with at most one decimal, rounding down', () => {
    expect(formatCount(1000)).toBe('1K');
    expect(formatCount(1250)).toBe('1.2K');
    expect(formatCount(1999)).toBe('1.9K');
    expect(formatCount(15_000)).toBe('15K');
  });

  it('abbreviates millions', () => {
    expect(formatCount(1_000_000)).toBe('1M');
    expect(formatCount(3_450_000)).toBe('3.4M');
  });

  it('treats junk as zero', () => {
    expect(formatCount(NaN)).toBe('0');
    expect(formatCount(-5)).toBe('0');
  });
});
