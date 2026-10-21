import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowState, LikedItem, ProfileComment, UserProfile, VideoItem } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { UserService } from '../core/services/user.service';
import { VideoService } from '../core/services/video.service';
import { ProfilePage } from './profile-page';
import { signal } from '@angular/core';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  username: 'marek', createdAtUtc: '2026-01-01T00:00:00Z', videoCount: 2, likeCount: 1, bio: 'Hello\nworld',
  avatarUrl: null, followerCount: 1250, isFollowing: false, isSelf: false, likesVisible: false, likesPublic: false, ...over
});
const video = (id: string, over: Partial<VideoItem> = {}): VideoItem => ({
  id, title: `Title ${id}`, uploadedAtUtc: '', status: 'Ready', renditions: [], likeCount: 0, likedByMe: false,
  commentCount: 0, isOwner: false, thumbnailUrl: null, author: { username: 'marek' }, ...over
});
const comment = (id: string): ProfileComment => ({
  id, text: `comment ${id}`, createdAtUtc: new Date().toISOString(), likeCount: 2, likedByMe: false,
  video: { id: 'v', title: `Video of ${id}`, authorUsername: 'alice' }
});
const likedVideo = (id: string): LikedItem => ({ type: 'video', likedAtUtc: new Date().toISOString(), video: video(id, { author: { username: 'alice' } }), comment: null });
const likedComment = (id: string): LikedItem => ({
  type: 'comment', likedAtUtc: new Date().toISOString(), video: null,
  comment: { id, text: `liked ${id}`, createdAtUtc: new Date().toISOString(), author: { username: 'bob' }, likeCount: 1, likedByMe: false, video: { id: 'v', title: 'Some video', authorUsername: 'alice' } }
});

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let el: HTMLElement;
  const users = { getProfile: vi.fn(), getComments: vi.fn(), getLikes: vi.fn(), follow: vi.fn(), unfollow: vi.fn() };
  const videos = { getUserVideos: vi.fn() };
  const user = signal<{ id: string; username: string } | null>({ id: '1', username: 'me' });

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const q = (s: string) => el.querySelector(s) as HTMLElement | null;
  const tabLabels = () => Array.from(el.querySelectorAll('.tab')).map((t) => t.textContent!.trim());
  const openTab = async (label: string) => {
    (Array.from(el.querySelectorAll('.tab')).find((t) => t.textContent!.trim() === label) as HTMLElement).click();
    await settle();
  };

  async function create(username = 'marek') {
    fixture = TestBed.createComponent(ProfilePage);
    fixture.componentRef.setInput('username', username);
    el = fixture.nativeElement;
    await settle();
  }

  beforeEach(() => {
    Object.values(users).forEach((m) => m.mockReset());
    videos.getUserVideos.mockReset();
    user.set({ id: '1', username: 'me' });
    users.getProfile.mockReturnValue(of(profile()));
    users.getComments.mockReturnValue(of([]));
    users.getLikes.mockReturnValue(of([]));
    videos.getUserVideos.mockReturnValue(of([video('a'), video('b')]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: users },
        { provide: VideoService, useValue: videos },
        { provide: AuthService, useValue: { user, isLoggedIn: () => user() !== null } }
      ]
    });
  });

  describe('header', () => {
    it('shows the name, a compact follower count, the bio and a big Follow button', async () => {
      await create();
      expect(q('h1')!.textContent).toBe('@marek');
      expect(q('.stats')!.textContent).toContain('1.2K');
      expect(q('.stats')!.textContent).toContain('Followers');
      expect(q('.bio')!.textContent).toBe('Hello\nworld');
      expect(q('app-follow-button button')!.textContent!.trim()).toBe('Follow');
    });

    it('puts the Follow button below the bio', async () => {
      await create();
      const bio = q('.bio')!;
      const button = q('app-follow-button')!;
      expect(bio.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('says "Follower" for exactly one and has no bio paragraph when there is none', async () => {
      users.getProfile.mockReturnValue(of(profile({ followerCount: 1, bio: null })));
      await create();
      expect(q('.stats')!.textContent).toContain('1 Follower');
      expect(q('.stats')!.textContent).not.toContain('Followers');
      expect(q('.bio')).toBeNull();
    });

    it('shows Edit profile instead of Follow on your own page', async () => {
      users.getProfile.mockReturnValue(of(profile({ isSelf: true, likesVisible: true })));
      await create();
      expect(q('app-follow-button button')!.textContent!.trim()).toBe('Edit profile');
    });

    it('updates the follower count when you follow, and back when you unfollow', async () => {
      users.getProfile.mockReturnValue(of(profile({ followerCount: 999 })));
      users.follow.mockReturnValue(of<FollowState>({ followerCount: 1000, following: true }));
      users.unfollow.mockReturnValue(of<FollowState>({ followerCount: 999, following: false }));
      await create();
      expect(q('.stats')!.textContent).toContain('999');

      q('app-follow-button button')!.click();
      await settle();
      expect(users.follow).toHaveBeenCalledWith('marek');
      expect(q('.stats')!.textContent).toContain('1K'); // 1000 shows compactly
      expect(q('app-follow-button button')!.textContent!.trim()).toBe('Following');

      q('app-follow-button button')!.click();
      await settle();
      expect(q('.stats')!.textContent).toContain('999');
      expect(q('app-follow-button button')!.textContent!.trim()).toBe('Follow');
    });

    it('tells you when the user does not exist, and when it failed to load', async () => {
      users.getProfile.mockReturnValue(throwError(() => ({ status: 404 })));
      await create('nobody');
      expect(el.textContent).toContain('No such user');

      users.getProfile.mockReturnValue(throwError(() => ({ status: 500 })));
      await create('x');
      expect(el.textContent).toContain('Could not load this profile');
    });
  });

  describe('tabs', () => {
    it('offers Videos and Comments, and Liked only when the viewer may see it', async () => {
      await create();
      expect(tabLabels()).toEqual(['Videos', 'Comments']);

      users.getProfile.mockReturnValue(of(profile({ likesVisible: true })));
      await create();
      expect(tabLabels()).toEqual(['Videos', 'Comments', 'Liked']);
    });

    it('starts on Videos, already loaded, as a grid', async () => {
      await create();
      expect(videos.getUserVideos).toHaveBeenCalledWith('marek', 0, 12);
      expect(el.querySelectorAll('app-video-grid a')).toHaveLength(2);
      expect(q('.tab.active')!.textContent!.trim()).toBe('Videos');
    });

    it('loads the other tabs only when they are first opened, and only once', async () => {
      users.getProfile.mockReturnValue(of(profile({ likesVisible: true })));
      await create();
      expect(users.getComments).not.toHaveBeenCalled();
      expect(users.getLikes).not.toHaveBeenCalled();

      await openTab('Comments');
      await openTab('Videos');
      await openTab('Comments');
      expect(users.getComments).toHaveBeenCalledTimes(1);
      expect(users.getComments).toHaveBeenCalledWith('marek', 0, 20);

      await openTab('Liked');
      expect(users.getLikes).toHaveBeenCalledTimes(1);
    });

    it('moves between tabs with the arrow keys, wrapping around, and loads what it lands on', async () => {
      await create();
      const key = async (k: string) => {
        q('.tabs')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
        await settle();
      };

      await key('ArrowRight');
      expect(q('.tab.active')!.textContent!.trim()).toBe('Comments');
      expect(users.getComments).toHaveBeenCalled();

      await key('ArrowRight'); // two tabs only: wraps to the first
      expect(q('.tab.active')!.textContent!.trim()).toBe('Videos');
      await key('ArrowLeft');
      expect(q('.tab.active')!.textContent!.trim()).toBe('Comments');
      await key('Home');
      expect(q('.tab.active')!.textContent!.trim()).toBe('Videos');
    });

    it('marks the active tab for assistive technology and gives only it a tab stop', async () => {
      await create();
      const tabs = Array.from(el.querySelectorAll('.tab'));
      expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1']);
      expect(q('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe('tab-videos');
    });
  });

  describe('videos tab', () => {
    it('has a friendly empty state, with a nudge to upload on your own page', async () => {
      videos.getUserVideos.mockReturnValue(of([]));
      await create();
      expect(el.textContent).toContain('No videos yet');
      expect(q('a[href="/upload"]')).toBeNull();

      users.getProfile.mockReturnValue(of(profile({ isSelf: true, likesVisible: true })));
      await create();
      expect(q('a[href="/upload"]')).not.toBeNull();
    });

    it('pages through a long list', async () => {
      const full = Array.from({ length: 12 }, (_, i) => video(`p${i}`));
      videos.getUserVideos.mockReturnValueOnce(of(full)).mockReturnValueOnce(of([video('last')]));
      await create();
      expect(el.querySelectorAll('app-video-grid a')).toHaveLength(12);

      (q('.more') as HTMLButtonElement).click();
      await settle();

      expect(videos.getUserVideos).toHaveBeenLastCalledWith('marek', 12, 12);
      expect(el.querySelectorAll('app-video-grid a')).toHaveLength(13);
      expect(q('.more')).toBeNull();
    });
  });

  describe('comments tab', () => {
    it('lists their comments, newest first as the server sent them, each with its video, display only', async () => {
      users.getComments.mockReturnValue(of([comment('one'), comment('two')]));
      await create();
      await openTab('Comments');

      const rows = Array.from(el.querySelectorAll('app-comment-row'));
      expect(rows.map((r) => r.querySelector('.text')!.textContent)).toEqual(['comment one', 'comment two']);
      expect(rows[0].textContent).toContain('Video of one');
      expect(el.querySelector('app-comment-row a, app-comment-row button')).toBeNull();
    });

    it('has an empty state', async () => {
      await create();
      await openTab('Comments');
      expect(el.textContent).toContain('No comments yet');
    });
  });

  describe('liked tab', () => {
    beforeEach(() => users.getProfile.mockReturnValue(of(profile({ likesVisible: true }))));

    it('mixes liked videos and liked comments in the order the server gives (newest like first)', async () => {
      users.getLikes.mockReturnValue(of([likedVideo('v1'), likedComment('c1'), likedVideo('v2')]));
      await create();
      await openTab('Liked');

      const order = Array.from(el.querySelectorAll('.liked-video, app-comment-row')).map((n) =>
        n.matches('.liked-video') ? `video:${n.querySelector('strong')!.textContent}` : `comment:${n.querySelector('.text')!.textContent}`);
      expect(order).toEqual(['video:Title v1', 'comment:liked c1', 'video:Title v2']);
    });

    it('shows who wrote a liked comment, and links a liked video to its author\'s feed', async () => {
      users.getLikes.mockReturnValue(of([likedVideo('v1'), likedComment('c1')]));
      await create();
      await openTab('Liked');

      expect(q('app-comment-row .author')!.textContent).toBe('@bob');
      expect(q('.liked-video')!.getAttribute('href')).toBe('/u/alice/v/v1');
    });

    it('reminds you, on your own page, that nobody else sees it until you allow it', async () => {
      users.getProfile.mockReturnValue(of(profile({ isSelf: true, likesVisible: true, likesPublic: false })));
      await create();
      await openTab('Liked');
      expect(q('.private')!.textContent).toContain('Only you can see this');

      users.getProfile.mockReturnValue(of(profile({ isSelf: true, likesVisible: true, likesPublic: true })));
      await create();
      await openTab('Liked');
      expect(q('.private')).toBeNull();
    });

    it('says so politely if the server refuses (403)', async () => {
      users.getLikes.mockReturnValue(throwError(() => ({ status: 403 })));
      await create();
      await openTab('Liked');
      expect(el.textContent).toContain('keeps their likes private');
    });
  });

  describe('moving between profiles', () => {
    it('starts afresh for the new person: their data, back on the Videos tab, other tabs reloaded', async () => {
      users.getProfile.mockImplementation((name: string) => of(profile({ username: name })));
      videos.getUserVideos.mockImplementation((name: string) => of([video(`${name}-clip`)]));
      await create('marek');
      await openTab('Comments');

      fixture.componentRef.setInput('username', 'alice');
      await settle();

      expect(q('h1')!.textContent).toBe('@alice');
      expect(q('.tab.active')!.textContent!.trim()).toBe('Videos');
      expect(q('app-video-grid a')!.getAttribute('aria-label')).toBe('Title alice-clip');

      await openTab('Comments');
      expect(users.getComments).toHaveBeenLastCalledWith('alice', 0, 20); // fetched again, for alice
    });

    it('ignores a slow answer for the previous person', async () => {
      const slow = new Subject<UserProfile>();
      users.getProfile.mockImplementation((name: string) => (name === 'slowpoke' ? slow : of(profile({ username: name }))));
      await create('slowpoke');

      fixture.componentRef.setInput('username', 'quick');
      await settle();
      slow.next(profile({ username: 'slowpoke' })); // arrives too late
      await settle();

      expect(q('h1')!.textContent).toBe('@quick');
    });
  });

  describe('editing your own profile', () => {
    beforeEach(() => users.getProfile.mockReturnValue(of(profile({ isSelf: true, likesVisible: true }))));

    it('opens the editor from the big button and shows changes right away', async () => {
      await create();
      expect(q('app-edit-profile-dialog')).toBeNull();

      q('app-follow-button button')!.click();
      await settle();
      expect(q('app-edit-profile-dialog')).not.toBeNull();

      const dialog = fixture.debugElement.query((d) => d.nativeElement.tagName === 'APP-EDIT-PROFILE-DIALOG');
      dialog.componentInstance.updated.emit({ bio: 'Fresh bio', avatarUrl: '/avatars/z.jpg', likesPublic: true });
      await settle();

      expect(q('.bio')!.textContent).toBe('Fresh bio');
      expect(q('app-avatar img')!.getAttribute('src')).toBe('http://localhost:5080/avatars/z.jpg');

      dialog.componentInstance.closed.emit();
      await settle();
      expect(q('app-edit-profile-dialog')).toBeNull();
    });
  });
});
