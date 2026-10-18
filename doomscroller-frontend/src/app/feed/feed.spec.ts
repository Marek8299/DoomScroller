import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
    getUserVideos: vi.fn(),
    getProfile: vi.fn(),
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
    api.getProfile.mockReturnValue(of(null));

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

  it('refreshes the profile header after a delete so its counts stay right', async () => {
    fixture.componentRef.setInput('username', 'someone');
    await flush();
    const before = api.getProfile.mock.calls.length;

    (fixture.componentInstance as any).onDeleted('a');
    await flush();

    expect(api.getProfile.mock.calls.length).toBe(before + 1);
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
});
