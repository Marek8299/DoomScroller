import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a message and hides it by itself', () => {
    const toast = new ToastService();
    toast.show('Link copied to clipboard');
    expect(toast.message()).toBe('Link copied to clipboard');

    vi.advanceTimersByTime(2499);
    expect(toast.message()).toBe('Link copied to clipboard');
    vi.advanceTimersByTime(2);
    expect(toast.message()).toBeNull();
  });

  it('a newer message replaces the old one and gets its own full duration', () => {
    const toast = new ToastService();
    toast.show('first');
    vi.advanceTimersByTime(2000);
    toast.show('second');

    vi.advanceTimersByTime(1000); // the first message's timer would have fired by now
    expect(toast.message()).toBe('second');
    vi.advanceTimersByTime(1600);
    expect(toast.message()).toBeNull();
  });
});
