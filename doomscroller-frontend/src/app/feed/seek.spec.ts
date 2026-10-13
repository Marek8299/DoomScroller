import { describe, expect, it } from 'vitest';
import { formatTime, progressPercent, seekTimeFromKey, seekTimeFromPointer } from './seek';

describe('seekTimeFromPointer', () => {
  it('maps the pointer position proportionally onto the duration', () => {
    expect(seekTimeFromPointer(150, 100, 200, 40)).toBe(10); // a quarter of the way along
  });

  it('clamps to the ends when the pointer is dragged outside the bar', () => {
    expect(seekTimeFromPointer(0, 100, 200, 40)).toBe(0);
    expect(seekTimeFromPointer(900, 100, 200, 40)).toBe(40);
  });

  it('returns 0 while the duration or bar width is unknown', () => {
    expect(seekTimeFromPointer(150, 100, 200, NaN)).toBe(0);
    expect(seekTimeFromPointer(150, 100, 0, 40)).toBe(0);
  });
});

describe('seekTimeFromKey', () => {
  it('steps by 5 seconds, clamped to the video', () => {
    expect(seekTimeFromKey('ArrowRight', 10, 60)).toBe(15);
    expect(seekTimeFromKey('ArrowLeft', 10, 60)).toBe(5);
    expect(seekTimeFromKey('ArrowLeft', 2, 60)).toBe(0);
    expect(seekTimeFromKey('ArrowRight', 58, 60)).toBe(60);
  });

  it('jumps to the start and end', () => {
    expect(seekTimeFromKey('Home', 30, 60)).toBe(0);
    expect(seekTimeFromKey('End', 30, 60)).toBe(60);
  });

  it('ignores other keys and unknown durations', () => {
    expect(seekTimeFromKey('a', 10, 60)).toBeNull();
    expect(seekTimeFromKey('ArrowRight', 10, NaN)).toBeNull();
  });
});

describe('progressPercent', () => {
  it('is a percentage of the duration', () => {
    expect(progressPercent(15, 60)).toBe(25);
  });

  it('is 0 before metadata has loaded', () => {
    expect(progressPercent(0, NaN)).toBe(0);
    expect(progressPercent(5, Infinity)).toBe(0);
    expect(progressPercent(5, 0)).toBe(0);
  });

  it('never leaves 0-100', () => {
    expect(progressPercent(70, 60)).toBe(100);
    expect(progressPercent(-1, 60)).toBe(0);
  });
});

describe('formatTime', () => {
  it('formats as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('tolerates NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });
});
