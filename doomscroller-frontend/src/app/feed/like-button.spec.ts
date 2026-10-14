import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LikeState } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { VideoService } from '../core/services/video.service';
import { LikeButton } from './like-button';

describe('LikeButton', () => {
  let fixture: ComponentFixture<LikeButton>;
  let el: HTMLElement;
  const loggedIn = signal(true);
  const user = signal<{ id: string; username: string } | null>({ id: '1', username: 'me' });
  const videos = { like: vi.fn(), unlike: vi.fn() };
  const router = { navigate: vi.fn(), url: '/u/someone' };

  const button = () => el.querySelector('button') as HTMLButtonElement;
  const count = () => el.querySelector('.count')!.textContent!.trim();

  async function create(inputs: { count: number; likedByMe: boolean }) {
    fixture = TestBed.createComponent(LikeButton);
    fixture.componentRef.setInput('videoId', 'v1');
    fixture.componentRef.setInput('count', inputs.count);
    fixture.componentRef.setInput('likedByMe', inputs.likedByMe);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    loggedIn.set(true);
    user.set({ id: '1', username: 'me' });
    videos.like.mockReset();
    videos.unlike.mockReset();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: VideoService, useValue: videos },
        { provide: AuthService, useValue: { isLoggedIn: loggedIn, user } },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('shows the count compactly and the liked state accessibly', async () => {
    await create({ count: 1250, likedByMe: true });
    expect(count()).toBe('1.2K');
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().getAttribute('aria-label')).toBe('Unlike');
  });

  it('likes optimistically, before the server has answered, then adopts the server state', async () => {
    const response = new Subject<LikeState>();
    videos.like.mockReturnValue(response);
    await create({ count: 4, likedByMe: false });

    button().click();
    await fixture.whenStable();
    expect(count()).toBe('5'); // instant
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(videos.like).toHaveBeenCalledWith('v1');

    response.next({ likeCount: 9, liked: true }); // others liked meanwhile
    await fixture.whenStable();
    expect(count()).toBe('9');
  });

  it('unlikes through the unlike endpoint', async () => {
    videos.unlike.mockReturnValue(of({ likeCount: 3, liked: false }));
    await create({ count: 4, likedByMe: true });

    button().click();
    await fixture.whenStable();

    expect(videos.unlike).toHaveBeenCalledWith('v1');
    expect(count()).toBe('3');
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('rolls back when the request fails', async () => {
    videos.like.mockReturnValue(throwError(() => ({ status: 500 })));
    await create({ count: 4, likedByMe: false });

    button().click();
    await fixture.whenStable();

    expect(count()).toBe('4');
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ignores extra taps while a request is in flight', async () => {
    videos.like.mockReturnValue(new Subject<LikeState>());
    await create({ count: 4, likedByMe: false });

    button().click();
    button().click();
    button().click();
    await fixture.whenStable();

    expect(videos.like).toHaveBeenCalledTimes(1);
    expect(count()).toBe('5');
  });

  it('sends signed-out visitors to the login page, coming back afterwards, without liking', async () => {
    loggedIn.set(false);
    await create({ count: 4, likedByMe: false });

    button().click();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/u/someone' } });
    expect(videos.like).not.toHaveBeenCalled();
    expect(count()).toBe('4');
  });

  it('treats an expired session (401) as signed out: rolls back and goes to login', async () => {
    videos.like.mockReturnValue(throwError(() => ({ status: 401 })));
    await create({ count: 4, likedByMe: false });

    button().click();
    await fixture.whenStable();

    expect(count()).toBe('4');
    expect(user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/u/someone' } });
  });

  it('adopts fresh server values when the feed refreshes', async () => {
    await create({ count: 4, likedByMe: false });

    fixture.componentRef.setInput('count', 12);
    fixture.componentRef.setInput('likedByMe', true);
    await fixture.whenStable();

    expect(count()).toBe('12');
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });
});
