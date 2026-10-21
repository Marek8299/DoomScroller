import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentItem } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { CommentService } from '../core/services/comment.service';
import { CommentsPanel } from './comments-panel';

const comment = (id: string, over: Partial<CommentItem> = {}): CommentItem => ({
  id,
  text: `text ${id}`,
  createdAtUtc: new Date().toISOString(),
  author: { username: `user_${id}` },
  canDelete: false,
  likeCount: 0,
  likedByMe: false,
  ...over
});

describe('CommentsPanel', () => {
  let fixture: ComponentFixture<CommentsPanel>;
  let el: HTMLElement;
  const user = signal<{ id: string; username: string } | null>({ id: '1', username: 'me' });
  const api = { getComments: vi.fn(), post: vi.fn(), delete: vi.fn() };
  const emitted = { count: [] as number[], closed: 0 };

  const rows = () => Array.from(el.querySelectorAll('.comment'));
  const textarea = () => el.querySelector('textarea') as HTMLTextAreaElement;
  const submitButton = () => el.querySelector('.composer button[type="submit"]') as HTMLButtonElement;
  const type = async (value: string) => {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  async function create(count = 3) {
    fixture = TestBed.createComponent(CommentsPanel);
    fixture.componentRef.setInput('videoId', 'v1');
    fixture.componentRef.setInput('count', count);
    fixture.componentInstance.countChange.subscribe((n) => emitted.count.push(n));
    fixture.componentInstance.closed.subscribe(() => emitted.closed++);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    user.set({ id: '1', username: 'me' });
    api.getComments.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
    api.getComments.mockReturnValue(of([]));
    emitted.count = [];
    emitted.closed = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CommentService, useValue: api },
        { provide: AuthService, useValue: { user, isLoggedIn: () => user() !== null } }
      ]
    });
  });

  it('loads the first page and shows the comments with a pluralised title', async () => {
    api.getComments.mockReturnValue(of([comment('a'), comment('b')]));
    await create(2);

    expect(api.getComments).toHaveBeenCalledWith('v1', 0, 20);
    expect(rows()).toHaveLength(2);
    expect(el.querySelector('h2')!.textContent).toBe('2 comments');
    expect(el.textContent).toContain('@user_a');
  });

  it('uses the singular for one comment and has a friendly empty state', async () => {
    await create(1);
    expect(el.querySelector('h2')!.textContent).toBe('1 comment');
    expect(el.textContent).toContain('No comments yet');
  });

  it('shows an error if loading fails', async () => {
    api.getComments.mockReturnValue(throwError(() => ({ status: 500 })));
    await create();
    expect(el.textContent).toContain("Couldn't load comments");
  });

  it('only offers Delete on comments the viewer may delete', async () => {
    api.getComments.mockReturnValue(of([comment('a', { canDelete: true }), comment('b')]));
    await create();
    const deletes = el.querySelectorAll('.delete');
    expect(deletes).toHaveLength(1);
    expect(rows()[0].contains(deletes[0])).toBe(true);
  });

  describe('posting', () => {
    it('uses an accessible icon button instead of the word "Post"', async () => {
      await create();
      expect(submitButton().querySelector('svg')).not.toBeNull();
      expect(submitButton().textContent!.trim()).toBe('');
      expect(submitButton().getAttribute('aria-label')).toBe('Post comment');
    });

    it('keeps Post disabled while the box is empty or only whitespace', async () => {
      await create();
      expect(submitButton().disabled).toBe(true);
      await type('   ');
      expect(submitButton().disabled).toBe(true);
      await type('hello');
      expect(submitButton().disabled).toBe(false);
    });

    it('sends trimmed text, shows the new comment first, clears the box and reports the new total', async () => {
      api.getComments.mockReturnValue(of([comment('old')]));
      api.post.mockReturnValue(of(comment('new', { text: 'hello', canDelete: true })));
      await create(1);

      await type('  hello  ');
      submitButton().click();
      await fixture.whenStable();

      expect(api.post).toHaveBeenCalledWith('v1', 'hello');
      expect(rows()[0].textContent).toContain('hello');
      expect(rows()).toHaveLength(2);
      expect(textarea().value).toBe('');
      expect(emitted.count).toEqual([2]);
    });

    it('sends on Enter but not on Shift+Enter', async () => {
      api.post.mockReturnValue(of(comment('new')));
      await create();
      await type('hi');

      textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
      expect(api.post).not.toHaveBeenCalled();

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      textarea().dispatchEvent(enter);
      expect(enter.defaultPrevented).toBe(true);
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('does not post twice while a request is in flight', async () => {
      api.post.mockReturnValue(new Subject<CommentItem>());
      await create();
      await type('hi');

      submitButton().click();
      await fixture.whenStable();
      textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('keeps what was typed and explains when rate limited', async () => {
      api.post.mockReturnValue(throwError(() => ({ status: 429 })));
      await create();
      await type('hello');

      submitButton().click();
      await fixture.whenStable();

      expect(textarea().value).toBe('hello');
      expect(el.querySelector('[role="alert"]')!.textContent).toContain('too fast');
      expect(emitted.count).toEqual([]);
    });

    it("shows the server's message for a rejected comment", async () => {
      api.post.mockReturnValue(throwError(() => ({ status: 400, error: 'Comment can be at most 500 characters.' })));
      await create();
      await type('x');
      submitButton().click();
      await fixture.whenStable();
      expect(el.querySelector('[role="alert"]')!.textContent).toContain('at most 500');
    });

    it('treats an expired session as signed out', async () => {
      api.post.mockReturnValue(throwError(() => ({ status: 401 })));
      await create();
      await type('hello');
      submitButton().click();
      await fixture.whenStable();

      expect(user()).toBeNull();
      expect(el.querySelector('[role="alert"]')!.textContent).toContain('log in again');
      expect(el.querySelector('textarea')).toBeNull();
    });
  });

  describe('deleting', () => {
    const askToDelete = async (index = 0) => {
      (el.querySelectorAll('.delete')[index] as HTMLButtonElement).click();
      await fixture.whenStable();
    };
    const confirmDelete = async () => {
      (el.querySelector('.confirm-delete') as HTMLButtonElement).click();
      await fixture.whenStable();
    };

    it('asks first: pressing Delete deletes nothing yet and shows a confirmation', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true })]));
      await create(1);

      await askToDelete();

      expect(api.delete).not.toHaveBeenCalled();
      expect(rows()).toHaveLength(1);
      expect(el.querySelector('.confirm')!.textContent).toContain('Delete this comment?');
      expect(el.querySelector('.delete')).toBeNull(); // the link is replaced by the question
    });

    it('focuses Cancel, so a stray Enter cannot delete anything', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true })]));
      await create(1);
      document.body.appendChild(el); // focus only works for elements that are in the document

      await askToDelete();
      await fixture.whenStable();

      expect(document.activeElement).toBe(el.querySelector('.cancel'));
      el.remove();
    });

    it('Cancel keeps the comment and never calls the server', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true })]));
      await create(1);

      await askToDelete();
      (el.querySelector('.cancel') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(api.delete).not.toHaveBeenCalled();
      expect(rows()).toHaveLength(1);
      expect(el.querySelector('.confirm')).toBeNull();
      expect(el.querySelector('.delete')).not.toBeNull(); // back to the normal link
      expect(emitted.count).toEqual([]);
    });

    it('asks about one comment at a time', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true }), comment('b', { canDelete: true })]));
      await create(2);

      await askToDelete(0);
      await askToDelete(0); // the first row's link is gone, so index 0 is now the second comment's link

      expect(el.querySelectorAll('.confirm')).toHaveLength(1);
      expect(rows()[1].querySelector('.confirm')).not.toBeNull();
    });

    it('Escape backs out of the question first and only then closes the panel', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true })]));
      await create(1);
      await askToDelete();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(el.querySelector('.confirm')).toBeNull();
      expect(emitted.closed).toBe(0);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(emitted.closed).toBe(1);
    });

    it('once confirmed, removes the comment at once and lowers the total', async () => {
      api.getComments.mockReturnValue(of([comment('a', { canDelete: true }), comment('b')]));
      api.delete.mockReturnValue(of(undefined));
      await create(2);

      await askToDelete();
      await confirmDelete();

      expect(api.delete).toHaveBeenCalledWith('v1', 'a');
      expect(rows()).toHaveLength(1);
      expect(el.querySelector('.confirm')).toBeNull();
      expect(emitted.count).toEqual([1]);
    });

    it('puts the comment back where it was if the server refuses', async () => {
      api.getComments.mockReturnValue(of([comment('a'), comment('b', { canDelete: true }), comment('c')]));
      api.delete.mockReturnValue(throwError(() => ({ status: 500 })));
      await create(3);

      await askToDelete();
      await confirmDelete();

      expect(rows().map((r) => r.textContent)).toEqual([
        expect.stringContaining('text a'),
        expect.stringContaining('text b'),
        expect.stringContaining('text c')
      ]);
      expect(emitted.count).toEqual([2, 3]); // lowered, then restored
      expect(el.querySelector('[role="alert"]')!.textContent).toContain("Couldn't delete");
    });
  });

  describe('paging', () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => comment(`p${i}`));

    it('offers "Load more" only after a full page', async () => {
      api.getComments.mockReturnValue(of(fullPage.slice(0, 5)));
      await create(5);
      expect(el.querySelector('.more')).toBeNull();
    });

    it('appends the next page from the right offset and skips duplicates', async () => {
      api.getComments.mockReturnValueOnce(of(fullPage));
      await create(25);
      expect(el.querySelector('.more')).not.toBeNull();

      api.getComments.mockReturnValueOnce(of([fullPage[19], comment('extra1'), comment('extra2')])); // overlaps by one
      (el.querySelector('.more button') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(api.getComments).toHaveBeenLastCalledWith('v1', 20, 20);
      expect(rows()).toHaveLength(22); // 20 + 2 new, the repeat was dropped
      expect(el.querySelector('.more')).toBeNull(); // short page: that was the end
    });
  });

  it('asks signed-out visitors to log in instead of showing the box', async () => {
    user.set(null);
    await create();

    expect(el.querySelector('textarea')).toBeNull();
    const link = el.querySelector('.login-prompt a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/login');
    expect(link.getAttribute('href')).toContain('returnUrl');
  });

  it('closes on the close button and on Escape', async () => {
    await create();
    (el.querySelector('.close') as HTMLButtonElement).click();
    expect(emitted.closed).toBe(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitted.closed).toBe(2);
  });
});
