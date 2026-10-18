import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoItem } from '../core/models/video.model';
import { VideoService } from '../core/services/video.service';
import { EditVideoPanel } from './edit-video-panel';

const video = (over: Partial<VideoItem> = {}): VideoItem => ({
  id: 'v1',
  title: 'Old title',
  description: 'Old description',
  uploadedAtUtc: '2026-10-01T00:00:00Z',
  status: 'Ready',
  renditions: [],
  likeCount: 0,
  likedByMe: false,
  commentCount: 0,
  isOwner: true,
  ...over
});

describe('EditVideoPanel', () => {
  let fixture: ComponentFixture<EditVideoPanel>;
  let el: HTMLElement;
  const api = { update: vi.fn() };
  const out = { saved: [] as VideoItem[], closed: 0 };

  const title = () => el.querySelector('input') as HTMLInputElement;
  const description = () => el.querySelector('textarea') as HTMLTextAreaElement;
  const save = () => el.querySelector('.save') as HTMLButtonElement;
  const type = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  async function create(v: VideoItem = video()) {
    fixture = TestBed.createComponent(EditVideoPanel);
    fixture.componentRef.setInput('video', v);
    fixture.componentInstance.saved.subscribe((u) => out.saved.push(u));
    fixture.componentInstance.closed.subscribe(() => out.closed++);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    api.update.mockReset();
    out.saved = [];
    out.closed = 0;
    TestBed.configureTestingModule({ providers: [{ provide: VideoService, useValue: api }] });
  });

  it('opens filled in with the current title and description', async () => {
    await create();
    expect(title().value).toBe('Old title');
    expect(description().value).toBe('Old description');
  });

  it('copes with a video that has no description', async () => {
    await create(video({ description: undefined }));
    expect(description().value).toBe('');
  });

  it('will not save a blank or whitespace-only title', async () => {
    await create();
    await type(title(), '');
    expect(save().disabled).toBe(true);
    await type(title(), '    ');
    expect(save().disabled).toBe(true);
    await type(title(), 'Fine');
    expect(save().disabled).toBe(false);
  });

  it('sends trimmed values and reports the server\'s version', async () => {
    const updated = video({ title: 'New title', description: undefined });
    api.update.mockReturnValue(of(updated));
    await create();

    await type(title(), '  New title  ');
    await type(description(), '   ');
    save().click();
    await fixture.whenStable();

    expect(api.update).toHaveBeenCalledWith('v1', 'New title', ''); // blank description = clear it
    expect(out.saved).toEqual([updated]);
  });

  it('shows progress and cannot be submitted twice', async () => {
    api.update.mockReturnValue(new Subject<VideoItem>());
    await create();

    save().click();
    await fixture.whenStable();
    save().click();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(save().textContent).toContain('Saving');
    expect(save().disabled).toBe(true);
  });

  it('keeps what was typed and shows the server message when saving fails', async () => {
    api.update.mockReturnValue(throwError(() => ({ status: 400, error: 'Title can be at most 200 characters.' })));
    await create();
    await type(title(), 'Something');

    save().click();
    await fixture.whenStable();

    expect(title().value).toBe('Something');
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('at most 200');
    expect(out.saved).toEqual([]);
  });

  it('explains a refusal (403)', async () => {
    api.update.mockReturnValue(throwError(() => ({ status: 403 })));
    await create();
    save().click();
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')!.textContent).toContain("can't edit this video");
  });

  it('closes from Cancel, the close button and Escape', async () => {
    await create();
    (el.querySelector('.cancel') as HTMLButtonElement).click();
    (el.querySelector('.close') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(out.closed).toBe(3);
  });

  it('is not overwritten when the feed refreshes the video underneath', async () => {
    await create();
    await type(title(), 'Half-typed edit');

    fixture.componentRef.setInput('video', video({ title: 'Refreshed title from poll' }));
    await fixture.whenStable();

    expect(title().value).toBe('Half-typed edit');
  });
});
