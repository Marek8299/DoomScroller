import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareService } from './share.service';
import { ToastService } from './toast.service';

describe('ShareService', () => {
  let service: ShareService;
  let toast: ToastService;
  const setNav = (name: 'share' | 'canShare' | 'clipboard', value: unknown) =>
    Object.defineProperty(navigator, name, { value, configurable: true });
  const video = { id: 'abc', title: 'My clip', authorName: 'marek' };

  beforeEach(() => {
    service = TestBed.inject(ShareService);
    toast = TestBed.inject(ToastService);
    setNav('share', undefined);
    setNav('canShare', undefined);
    setNav('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    setNav('share', undefined);
    setNav('canShare', undefined);
    setNav('clipboard', undefined);
  });

  it('builds the public address of a video', () => {
    const url = service.videoUrl('abc');
    expect(url.startsWith(window.location.origin)).toBe(true);
    expect(url.endsWith('/v/abc')).toBe(true);
  });

  describe('with a native share menu', () => {
    it('opens it with the title, a description and the link, and says nothing more', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNav('share', share);

      await service.shareVideo(video);

      expect(share).toHaveBeenCalledWith({
        title: 'My clip',
        text: 'My clip by @marek on DoomScroller',
        url: service.videoUrl('abc')
      });
      expect(toast.message()).toBeNull();
      expect((navigator.clipboard.writeText as any).mock.calls).toHaveLength(0);
    });

    it('describes videos without a known author too', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNav('share', share);
      await service.shareVideo({ id: 'abc', title: 'Old clip' });
      expect(share.mock.calls[0][0].text).toBe('Old clip on DoomScroller');
    });

    it('treats closing the menu without choosing as a decision: no copy, no notice', async () => {
      setNav('share', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
      await service.shareVideo(video);

      expect(toast.message()).toBeNull();
      expect((navigator.clipboard.writeText as any).mock.calls).toHaveLength(0);
    });

    it('falls back to copying the link if sharing fails for any other reason', async () => {
      setNav('share', vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')));
      await service.shareVideo(video);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(service.videoUrl('abc'));
      expect(toast.message()).toBe('Link copied to clipboard');
    });

    it('skips a menu that says it cannot share this data', async () => {
      const share = vi.fn();
      setNav('share', share);
      setNav('canShare', () => false);

      await service.shareVideo(video);

      expect(share).not.toHaveBeenCalled();
      expect(toast.message()).toBe('Link copied to clipboard');
    });
  });

  describe('without one (e.g. desktop Firefox)', () => {
    it('copies the link and tells the user', async () => {
      await service.shareVideo(video);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(service.videoUrl('abc'));
      expect(toast.message()).toBe('Link copied to clipboard');
    });

    it('says so honestly when it cannot copy either', async () => {
      setNav('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
      (document as any).execCommand = vi.fn(() => false);

      await service.shareVideo(video);

      expect(toast.message()).toBe("Couldn't copy the link");
      (document as any).execCommand = undefined;
    });
  });
});
