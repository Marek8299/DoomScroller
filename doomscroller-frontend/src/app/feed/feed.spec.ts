import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoItem } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { CommentService } from '../core/services/comment.service';
import { VideoService } from '../core/services/video.service';
import { Feed } from './feed';

const video = (id: string, over: Partial<VideoItem> = {}): VideoItem => ({
  id,
  title: `Title ${id}`,
  uploadedAtUtc: '2026-10-01T00:00:00Z',
  status: 'Ready',
  renditions: [{ id: `r-${id}`, height: 720, isOriginalResolution: true, container: 'Mp4', videoCodec: 'h264', audioCodec: 'aac', sizeBytes: 1, status: 'Ready', url: `/media/${id}.mp4` }],
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  isOwner: false,
  ...over
});

describe('Feed', () => {
  let fixture: ComponentFixture<Feed>;
  let el: HTMLElement;
  let feedResponse: VideoItem[];
  const api = {
    getFeed: vi.fn(),
    getById: vi.fn(),
    getUserVideos: vi.fn(),
    mediaUrl: (u: string) => `http://x${u}`,
    like: vi.fn(),
    unlike: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  };

  const titles = () => Array.from(el.querySelectorAll('.feed-item h3')).map((h) => h.textContent!.trim());
  // Zoneless + fake timers: run change detection (which starts the feed's effects), let the timers
  // fire, then render what they produced. whenStable() isn't used because the 8s poll never "settles".
  const flush = async (ms = 0) => {
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    Object.values(api).forEach((f) => typeof f === 'function' && 'mockReset' in f && (f as any).mockReset());
    feedResponse = [video('a', { isOwner: true }), video('b'), video('c', { isOwner: true })];
    api.getFeed.mockImplementation(() => of(feedResponse));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: VideoService, useValue: api },
        { provide: CommentService, useValue: { getComments: () => of([]) } },
        { provide: AuthService, useValue: { user: signal(null), isLoggedIn: () => false } }
      ]
    });
    fixture = TestBed.createComponent(Feed);
    await flush();
    await flush();
    el = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  it('shows the owner menu only on the viewer\'s own videos', () => {
    const items = Array.from(el.querySelectorAll('.feed-item'));
    expect(items.map((i) => !!i.querySelector('app-owner-menu'))).toEqual([true, false, true]);
  });

  it('a deleted video disappears at once', async () => {
    (fixture.componentInstance as any).onDeleted('a');
    await flush();
    expect(titles()).toEqual(['Title b', 'Title c']);
  });

  it('a refresh that was already in flight cannot bring a deleted video back', async () => {
    (fixture.componentInstance as any).onDeleted('a');
    // The next poll still contains 'a' (the request left the server before the delete happened).
    await flush(8000);
    expect(titles()).toEqual(['Title b', 'Title c']);
  });

  it('saving an edit swaps in the server\'s version and closes the sheet', async () => {
    (fixture.componentInstance as any).startEdit('b');
    await flush();
    expect(el.querySelector('app-edit-video-panel')).not.toBeNull();

    (fixture.componentInstance as any).onSaved(video('b', { title: 'Renamed' }));
    await flush();

    expect(titles()).toEqual(['Title a', 'Renamed', 'Title c']);
    expect(el.querySelector('app-edit-video-panel')).toBeNull();
  });

  it('keeps one sheet open at a time: editing closes comments and vice versa', async () => {
    const feed = fixture.componentInstance as any;
    feed.toggleComments('a');
    await flush();
    expect(el.querySelector('app-comments-panel')).not.toBeNull();

    feed.startEdit('a');
    await flush();
    expect(el.querySelector('app-comments-panel')).toBeNull();
    expect(el.querySelector('app-edit-video-panel')).not.toBeNull();

    feed.toggleComments('a');
    await flush();
    expect(el.querySelector('app-edit-video-panel')).toBeNull();
    expect(el.querySelector('app-comments-panel')).not.toBeNull();
  });

  it('an unfinished video of your own still gets the menu, so a stuck upload can be removed', async () => {
    feedResponse = [video('stuck', { isOwner: true, status: 'Processing', renditions: [] })];
    await flush(8000);

    const item = el.querySelector('.feed-item')!;
    expect(item.querySelector('.pending')).not.toBeNull();
    expect(item.querySelector('app-owner-menu')).not.toBeNull();
  });

  describe('shared links and the address bar', () => {
    let navigate: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    });

    const visible = (id: string) => (fixture.componentInstance as any).onInView(id);

    it('moves the address to the very first video as soon as it is showing, so it can be copied right away', () => {
      visible('a');
      expect(navigate).toHaveBeenCalledWith(['/v', 'a'], { replaceUrl: true });
    });

    it('then follows the video you scroll to, without adding Back-button history', () => {
      visible('a');
      visible('b');
      expect(navigate).toHaveBeenLastCalledWith(['/v', 'b'], { replaceUrl: true });

      visible('c');
      expect(navigate).toHaveBeenLastCalledWith(['/v', 'c'], { replaceUrl: true });
      for (const call of navigate.mock.calls) {
        expect(call[1]).toEqual({ replaceUrl: true });
      }
    });

    it('does nothing when there are no videos to show', async () => {
      feedResponse = [];
      await flush(8000);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does not re-navigate to the address it is already on', () => {
      fixture.componentRef.setInput('id', 'a');
      visible('a');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('keeps the author in the address while you watch their videos', async () => {
      fixture.componentRef.setInput('username', 'someone');
      api.getUserVideos.mockReturnValue(of(feedResponse));
      await flush();

      visible('a');
      expect(navigate).toHaveBeenCalledWith(['/u', 'someone', 'v', 'a'], { replaceUrl: true });
      visible('b');
      expect(navigate).toHaveBeenLastCalledWith(['/u', 'someone', 'v', 'b'], { replaceUrl: true });
    });
  });

  describe('opening a shared link (/v/:id)', () => {
    const open = async (id: string) => {
      fixture = TestBed.createComponent(Feed);
      fixture.componentRef.setInput('id', id);
      await flush();
      await flush();
      el = fixture.nativeElement;
    };

    it('puts the shared video first and does not repeat it further down', async () => {
      api.getById.mockReturnValue(of(video('b')));
      await open('b');

      expect(api.getById).toHaveBeenCalledWith('b');
      expect(titles()).toEqual(['Title b', 'Title a', 'Title c']);
      expect(el.querySelector('.notice')).toBeNull();
    });

    it('shows the shared video even if it is not in the first page of the feed', async () => {
      api.getById.mockReturnValue(of(video('old')));
      await open('old');
      expect(titles()).toEqual(['Title old', 'Title a', 'Title b', 'Title c']);
    });

    it('explains a link to a deleted or private video, and still shows the feed', async () => {
      api.getById.mockReturnValue(throwError(() => ({ status: 404 })));
      await open('gone');

      expect(el.querySelector('.notice')!.textContent).toContain("isn't available");
      expect(titles()).toEqual(['Title a', 'Title b', 'Title c']);
    });

    it('treats any other failure as a real error', async () => {
      api.getById.mockReturnValue(throwError(() => ({ status: 500 })));
      await open('x');
      expect(el.querySelector('.status.error')).not.toBeNull();
    });

    it('does not reload the feed when the address bar moves to another video as you scroll', async () => {
      api.getById.mockReturnValue(of(video('b')));
      await open('b');
      const loads = api.getFeed.mock.calls.length;

      fixture.componentRef.setInput('id', 'c'); // what the router does after our replaceUrl navigation
      await flush();

      expect(api.getFeed.mock.calls.length).toBe(loads);
      expect(api.getById).toHaveBeenCalledTimes(1);
      expect(titles()).toEqual(['Title b', 'Title a', 'Title c']);
    });

    it('opened from a profile, shows that video first and then the rest of that author\'s videos', async () => {
      api.getById.mockReturnValue(of(video('b')));
      api.getUserVideos.mockReturnValue(of([video('a'), video('b'), video('c')]));
      api.getFeed.mockClear(); // the beforeEach feed already asked for the global list
      fixture = TestBed.createComponent(Feed);
      fixture.componentRef.setInput('username', 'someone');
      fixture.componentRef.setInput('id', 'b');
      await flush();
      await flush();
      el = fixture.nativeElement;

      expect(api.getUserVideos).toHaveBeenCalledWith('someone', 0, 20);
      expect(api.getFeed).not.toHaveBeenCalledWith(0, 20); // not the global feed
      expect(titles()).toEqual(['Title b', 'Title a', 'Title c']);
    });

    it('offers a share button on every playable video', async () => {
      api.getById.mockReturnValue(of(video('b')));
      await open('b');
      expect(el.querySelectorAll('app-share-button')).toHaveLength(3);
    });
  });
});
