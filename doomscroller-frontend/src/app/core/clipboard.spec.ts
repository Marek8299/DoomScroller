import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
  const setExec = (fn: unknown) => ((document as any).execCommand = fn);

  beforeEach(() => setClipboard(undefined));
  afterEach(() => {
    setClipboard(undefined);
    setExec(undefined);
  });

  it('uses the modern clipboard API when there is one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    expect(await copyToClipboard('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to select-and-copy when the API is missing (plain-http pages)', async () => {
    let copiedWhileSelected = '';
    setExec(
      vi.fn(() => {
        copiedWhileSelected = (document.querySelector('textarea') as HTMLTextAreaElement).value;
        return true;
      })
    );

    expect(await copyToClipboard('http://x/v/1')).toBe(true);
    expect(copiedWhileSelected).toBe('http://x/v/1');
    expect(document.querySelector('textarea')).toBeNull(); // the helper element is cleaned up
  });

  it('falls back when the API refuses (permission denied)', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExec(vi.fn(() => true));
    expect(await copyToClipboard('x')).toBe(true);
  });

  it('reports failure, and still cleans up, when nothing works', async () => {
    setExec(vi.fn(() => false));
    expect(await copyToClipboard('x')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();

    setExec(
      vi.fn(() => {
        throw new Error('nope');
      })
    );
    expect(await copyToClipboard('x')).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
