import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { VideoItem } from '../core/models/video.model';
import { ShareService } from '../core/services/share.service';
import { ShareButton } from './share-button';

const video = (over: Partial<VideoItem> = {}): VideoItem => ({
  id: 'v1', title: 'Clip', uploadedAtUtc: '', status: 'Ready', renditions: [],
  likeCount: 0, likedByMe: false, commentCount: 0, isOwner: false, ...over
});

describe('ShareButton', () => {
  async function render(v: VideoItem) {
    const shareVideo = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: ShareService, useValue: { shareVideo } }] });
    const fixture = TestBed.createComponent(ShareButton);
    fixture.componentRef.setInput('video', v);
    await fixture.whenStable();
    return { fixture, shareVideo, button: fixture.nativeElement.querySelector('button') as HTMLButtonElement };
  }

  it('is an accessible button that shares this video with its author', async () => {
    const { button, shareVideo } = await render(video({ author: { username: 'marek' } }));
    expect(button.getAttribute('aria-label')).toBe('Share');

    button.click();
    expect(shareVideo).toHaveBeenCalledWith({ id: 'v1', title: 'Clip', authorName: 'marek' });
  });

  it('works for videos with no author', async () => {
    const { button, shareVideo } = await render(video());
    button.click();
    expect(shareVideo).toHaveBeenCalledWith({ id: 'v1', title: 'Clip', authorName: undefined });
  });
});
