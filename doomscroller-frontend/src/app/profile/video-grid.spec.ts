import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { VideoItem } from '../core/models/video.model';
import { VideoGrid } from './video-grid';

const video = (id: string, over: Partial<VideoItem> = {}): VideoItem => ({
  id, title: `Title ${id}`, uploadedAtUtc: '', status: 'Ready', renditions: [], likeCount: 0, likedByMe: false,
  commentCount: 0, isOwner: false, thumbnailUrl: null, author: { username: 'marek' }, ...over
});

describe('VideoGrid', () => {
  async function render(videos: VideoItem[]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(VideoGrid);
    fixture.componentRef.setInput('videos', videos);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows one cell per video, linking to that video inside its author\'s feed', async () => {
    const el = await render([video('a'), video('b')]);
    const links = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/u/marek/v/a', '/u/marek/v/b']);
  });

  it('falls back to the plain video address when the author is unknown', async () => {
    const el = await render([video('old', { author: undefined })]);
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/v/old');
  });

  it('uses the thumbnail when there is one and a placeholder when there is not', async () => {
    const el = await render([video('a', { thumbnailUrl: '/thumbs/a.jpg' }), video('b')]);
    const cells = Array.from(el.querySelectorAll('a'));
    expect(cells[0].querySelector('img')!.getAttribute('src')).toBe('http://localhost:5080/thumbs/a.jpg');
    expect(cells[1].querySelector('img')).toBeNull();
    expect(cells[1].querySelector('.placeholder')).not.toBeNull();
  });

  it('labels each cell with its title and shows a compact like count', async () => {
    const el = await render([video('a', { likeCount: 1250 })]);
    expect(el.querySelector('a')!.getAttribute('aria-label')).toBe('Title a');
    expect(el.querySelector('.likes')!.textContent).toContain('1.2K');
  });

  it('flags videos that are not published yet (only their author ever sees these)', async () => {
    const el = await render([video('a', { status: 'Processing' }), video('b', { status: 'Failed' }), video('c')]);
    const badges = Array.from(el.querySelectorAll('.badge')).map((b) => b.textContent!.trim());
    expect(badges).toEqual(['Processing', 'Failed']);
  });
});
