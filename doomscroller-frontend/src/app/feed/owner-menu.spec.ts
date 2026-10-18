import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoService } from '../core/services/video.service';
import { OwnerMenu } from './owner-menu';

describe('OwnerMenu', () => {
  let fixture: ComponentFixture<OwnerMenu>;
  let el: HTMLElement;
  const api = { delete: vi.fn() };
  const out = { edit: 0, deleted: 0 };

  const q = (selector: string) => el.querySelector(selector) as HTMLElement | null;
  const click = async (selector: string) => {
    (q(selector) as HTMLElement).click();
    await fixture.whenStable();
  };
  const pressEscape = async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    api.delete.mockReset();
    out.edit = 0;
    out.deleted = 0;
    TestBed.configureTestingModule({ providers: [{ provide: VideoService, useValue: api }] });

    fixture = TestBed.createComponent(OwnerMenu);
    fixture.componentRef.setInput('videoId', 'v1');
    fixture.componentInstance.edit.subscribe(() => out.edit++);
    fixture.componentInstance.deleted.subscribe(() => out.deleted++);
    await fixture.whenStable();
    el = fixture.nativeElement;
    document.body.appendChild(el); // outside-click and focus checks need it in the document
  });

  it('starts closed and opens from the button, with accessible state', async () => {
    expect(q('.menu')).toBeNull();
    await click('.more');
    expect(q('.menu')).not.toBeNull();
    expect(q('.more')!.getAttribute('aria-expanded')).toBe('true');
    expect(el.textContent).toContain('Edit');
  });

  it('Edit asks the feed to open the edit sheet and closes the menu', async () => {
    await click('.more');
    await click('.item:not(.danger)');
    expect(out.edit).toBe(1);
    expect(q('.menu')).toBeNull();
  });

  it('Delete only asks: nothing is deleted yet, and Cancel is focused', async () => {
    await click('.more');
    await click('.danger');
    await fixture.whenStable();

    expect(api.delete).not.toHaveBeenCalled();
    expect(q('.confirm')!.textContent).toContain('This can\'t be undone');
    expect(document.activeElement).toBe(q('.cancel'));
  });

  it('Cancel goes back to the menu without deleting', async () => {
    await click('.more');
    await click('.danger');
    await click('.cancel');

    expect(api.delete).not.toHaveBeenCalled();
    expect(q('.confirm')).toBeNull();
    expect(q('.danger')).not.toBeNull();
    expect(out.deleted).toBe(0);
  });

  it('confirming deletes through the API and tells the feed', async () => {
    api.delete.mockReturnValue(of(undefined));
    await click('.more');
    await click('.danger');
    await click('.confirm-delete');

    expect(api.delete).toHaveBeenCalledWith('v1');
    expect(out.deleted).toBe(1);
    expect(q('.menu')).toBeNull();
  });

  it('shows progress and ignores a second confirm while the request is in flight', async () => {
    api.delete.mockReturnValue(new Subject<void>());
    await click('.more');
    await click('.danger');
    await click('.confirm-delete');
    await click('.confirm-delete');

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(q('.confirm-delete')!.textContent).toContain('Deleting');
    expect((q('.confirm-delete') as HTMLButtonElement).disabled).toBe(true);
  });

  it('treats "already gone" (404) as success', async () => {
    api.delete.mockReturnValue(throwError(() => ({ status: 404 })));
    await click('.more');
    await click('.danger');
    await click('.confirm-delete');
    expect(out.deleted).toBe(1);
  });

  it('keeps the video and explains when deleting fails', async () => {
    api.delete.mockReturnValue(throwError(() => ({ status: 500 })));
    await click('.more');
    await click('.danger');
    await click('.confirm-delete');

    expect(out.deleted).toBe(0);
    expect(q('[role="alert"]')!.textContent).toContain("Couldn't delete");
    expect((q('.confirm-delete') as HTMLButtonElement).disabled).toBe(false); // can retry
  });

  it('explains a refusal (403) differently from a failure', async () => {
    api.delete.mockReturnValue(throwError(() => ({ status: 403 })));
    await click('.more');
    await click('.danger');
    await click('.confirm-delete');
    expect(q('[role="alert"]')!.textContent).toContain("can't delete this video");
  });

  it('Escape backs out one level at a time: the question, then the menu', async () => {
    await click('.more');
    await click('.danger');

    await pressEscape();
    expect(q('.confirm')).toBeNull();
    expect(q('.menu')).not.toBeNull();

    await pressEscape();
    expect(q('.menu')).toBeNull();
  });

  it('closes when you tap elsewhere, but not when you tap inside it', async () => {
    await click('.more');
    q('.menu')!.click();
    await fixture.whenStable();
    expect(q('.menu')).not.toBeNull();

    document.body.click();
    await fixture.whenStable();
    expect(q('.menu')).toBeNull();
  });
});
