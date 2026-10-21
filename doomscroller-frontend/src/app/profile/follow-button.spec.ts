import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowState, UserProfile } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { UserService } from '../core/services/user.service';
import { FollowButton } from './follow-button';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  username: 'marek', createdAtUtc: '', videoCount: 0, likeCount: 0, bio: null, avatarUrl: null,
  followerCount: 10, isFollowing: false, isSelf: false, likesVisible: false, likesPublic: false, ...over
});

describe('FollowButton', () => {
  let fixture: ComponentFixture<FollowButton>;
  let el: HTMLElement;
  const loggedIn = signal(true);
  const user = signal<{ id: string; username: string } | null>({ id: '1', username: 'me' });
  const users = { follow: vi.fn(), unfollow: vi.fn() };
  const router = { navigate: vi.fn(), url: '/u/marek' };
  const emitted: FollowState[] = [];
  let edits = 0;

  const button = () => el.querySelector('button') as HTMLButtonElement;

  async function create(p: UserProfile) {
    fixture = TestBed.createComponent(FollowButton);
    fixture.componentRef.setInput('profile', p);
    fixture.componentInstance.followChanged.subscribe((s) => emitted.push(s));
    fixture.componentInstance.editRequested.subscribe(() => edits++);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    loggedIn.set(true);
    user.set({ id: '1', username: 'me' });
    users.follow.mockReset();
    users.unfollow.mockReset();
    router.navigate.mockReset();
    emitted.length = 0;
    edits = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: UserService, useValue: users },
        { provide: AuthService, useValue: { isLoggedIn: loggedIn, user } },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('on your own profile it is "Edit profile" and just asks the page to open the editor', async () => {
    await create(profile({ isSelf: true }));
    expect(button().textContent!.trim()).toBe('Edit profile');
    button().click();
    expect(edits).toBe(1);
    expect(users.follow).not.toHaveBeenCalled();
  });

  it('on someone else\'s it says Follow, or Following if you already do, with the state exposed accessibly', async () => {
    await create(profile());
    expect(button().textContent!.trim()).toBe('Follow');
    expect(button().getAttribute('aria-pressed')).toBe('false');

    await create(profile({ isFollowing: true }));
    expect(button().textContent!.trim()).toBe('Following');
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('follows at once, then adopts the server\'s answer', async () => {
    const response = new Subject<FollowState>();
    users.follow.mockReturnValue(response);
    await create(profile());

    button().click();
    expect(users.follow).toHaveBeenCalledWith('marek');
    expect(emitted).toEqual([{ followerCount: 11, following: true }]); // instant

    response.next({ followerCount: 14, following: true }); // others followed meanwhile
    expect(emitted.at(-1)).toEqual({ followerCount: 14, following: true });
  });

  it('unfollows through the unfollow endpoint', async () => {
    users.unfollow.mockReturnValue(of({ followerCount: 9, following: false }));
    await create(profile({ isFollowing: true }));

    button().click();

    expect(users.unfollow).toHaveBeenCalledWith('marek');
    expect(emitted).toEqual([
      { followerCount: 9, following: false },
      { followerCount: 9, following: false }
    ]);
  });

  it('rolls back exactly when the request fails', async () => {
    users.follow.mockReturnValue(throwError(() => ({ status: 500 })));
    await create(profile({ followerCount: 10 }));

    button().click();

    expect(emitted).toEqual([
      { followerCount: 11, following: true },
      { followerCount: 10, following: false }
    ]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ignores extra taps while a request is in flight', async () => {
    users.follow.mockReturnValue(new Subject<FollowState>());
    await create(profile());

    button().click();
    button().click();
    button().click();

    expect(users.follow).toHaveBeenCalledTimes(1);
  });

  it('sends signed-out visitors to log in (and back here afterwards) without following', async () => {
    loggedIn.set(false);
    await create(profile());

    button().click();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/u/marek' } });
    expect(users.follow).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it('treats an expired session (401) as signed out: rolls back and goes to login', async () => {
    users.follow.mockReturnValue(throwError(() => ({ status: 401 })));
    await create(profile());

    button().click();

    expect(emitted.at(-1)).toEqual({ followerCount: 10, following: false });
    expect(user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/u/marek' } });
  });
});
