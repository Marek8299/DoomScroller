import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LikeState } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { CommentService } from '../core/services/comment.service';
import { CommentLike } from './comment-like';

describe('CommentLike', () => {
  let fixture: ComponentFixture<CommentLike>;
  let el: HTMLElement;
  const loggedIn = signal(true);
  const user = signal<{ id: string; username: string } | null>({ id: '1', username: 'me' });
  const comments = { like: vi.fn(), unlike: vi.fn() };
  const router = { navigate: vi.fn(), url: '/' };

  const button = () => el.querySelector('button') as HTMLButtonElement;
  const count = () => el.querySelector('.count')!.textContent!.trim();

  async function create(inputs: { count: number; likedByMe: boolean }) {
    fixture = TestBed.createComponent(CommentLike);
    fixture.componentRef.setInput('videoId', 'v1');
    fixture.componentRef.setInput('commentId', 'c1');
    fixture.componentRef.setInput('count', inputs.count);
    fixture.componentRef.setInput('likedByMe', inputs.likedByMe);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    loggedIn.set(true);
    user.set({ id: '1', username: 'me' });
    comments.like.mockReset();
    comments.unlike.mockReset();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: CommentService, useValue: comments },
        { provide: AuthService, useValue: { isLoggedIn: loggedIn, user } },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('shows the count and an accessible liked state', async () => {
    await create({ count: 1250, likedByMe: true });
    expect(count()).toBe('1.2K');
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().getAttribute('aria-label')).toBe('Unlike comment');
  });

  it('likes instantly through the comment endpoint, then adopts the server state', async () => {
    const response = new Subject<LikeState>();
    comments.like.mockReturnValue(response);
    await create({ count: 4, likedByMe: false });

    button().click();
    await fixture.whenStable();
    expect(comments.like).toHaveBeenCalledWith('v1', 'c1');
    expect(count()).toBe('5');

    response.next({ likeCount: 9, liked: true });
    await fixture.whenStable();
    expect(count()).toBe('9');
  });

  it('unlikes through the unlike endpoint', async () => {
    comments.unlike.mockReturnValue(of({ likeCount: 3, liked: false }));
    await create({ count: 4, likedByMe: true });
    button().click();
    await fixture.whenStable();
    expect(comments.unlike).toHaveBeenCalledWith('v1', 'c1');
    expect(count()).toBe('3');
  });

  it('rolls back when the request fails, and ignores taps while one is running', async () => {
    comments.like.mockReturnValue(throwError(() => ({ status: 500 })));
    await create({ count: 4, likedByMe: false });
    button().click();
    await fixture.whenStable();
    expect(count()).toBe('4');
    expect(button().getAttribute('aria-pressed')).toBe('false');

    comments.like.mockReset();
    comments.like.mockReturnValue(new Subject<LikeState>());
    button().click();
    button().click();
    expect(comments.like).toHaveBeenCalledTimes(1);
  });

  it('sends signed-out visitors to log in without liking anything', async () => {
    loggedIn.set(false);
    await create({ count: 4, likedByMe: false });
    button().click();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
    expect(comments.like).not.toHaveBeenCalled();
  });

  it('treats an expired session (401) as signed out', async () => {
    comments.like.mockReturnValue(throwError(() => ({ status: 401 })));
    await create({ count: 4, likedByMe: false });
    button().click();
    await fixture.whenStable();
    expect(count()).toBe('4');
    expect(user()).toBeNull();
    expect(router.navigate).toHaveBeenCalled();
  });
});
