import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CommentRow } from './comment-row';

describe('CommentRow', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(CommentRow);
    const base = { text: 'Nice one', createdAtUtc: new Date().toISOString(), likeCount: 1250, videoTitle: 'My clip' };
    for (const [k, v] of Object.entries({ ...base, ...inputs })) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the text, which video it is on, when, and its likes', async () => {
    const el = await render({});
    expect(el.querySelector('.text')!.textContent).toBe('Nice one');
    expect(el.querySelector('.context')!.textContent).toContain('My clip');
    expect(el.querySelector('.context')!.textContent).toContain('just now');
    expect(el.querySelector('.context')!.textContent).toContain('1.2K');
  });

  it('names the video\'s author when known, and the comment\'s author when asked to', async () => {
    const el = await render({ videoAuthor: 'alice', authorUsername: 'bob' });
    expect(el.querySelector('.context')!.textContent).toContain('by @alice');
    expect(el.querySelector('.author')!.textContent).toBe('@bob');
  });

  it('shows no author line on a profile\'s own comments list', async () => {
    const el = await render({});
    expect(el.querySelector('.author')).toBeNull();
  });

  it('is display-only for now: no links and no buttons', async () => {
    const el = await render({ videoAuthor: 'alice', authorUsername: 'bob' });
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });
});
