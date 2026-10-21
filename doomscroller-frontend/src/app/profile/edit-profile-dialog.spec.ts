import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileEdit, UserProfile } from '../core/models/video.model';
import { UserService } from '../core/services/user.service';
import { EditProfileDialog } from './edit-profile-dialog';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  username: 'marek', createdAtUtc: '', videoCount: 0, likeCount: 0, bio: 'Old bio', avatarUrl: '/avatars/a.jpg',
  followerCount: 0, isFollowing: false, isSelf: true, likesVisible: true, likesPublic: false, ...over
});

describe('EditProfileDialog', () => {
  let fixture: ComponentFixture<EditProfileDialog>;
  let el: HTMLElement;
  const users = { updateProfile: vi.fn(), uploadAvatar: vi.fn(), removeAvatar: vi.fn() };
  const out = { updated: [] as ProfileEdit[], closed: 0 };

  const bio = () => el.querySelector('textarea') as HTMLTextAreaElement;
  const toggle = () => el.querySelector('input[type="checkbox"]') as HTMLInputElement;
  const save = () => el.querySelector('.save') as HTMLButtonElement;
  const fileInput = () => el.querySelector('input[type="file"]') as HTMLInputElement;
  const error = () => el.querySelector('[role="alert"]')?.textContent ?? '';

  async function create(p: UserProfile = profile()) {
    fixture = TestBed.createComponent(EditProfileDialog);
    fixture.componentRef.setInput('profile', p);
    fixture.componentInstance.updated.subscribe((e) => out.updated.push(e));
    fixture.componentInstance.closed.subscribe(() => out.closed++);
    await fixture.whenStable();
    el = fixture.nativeElement;
  }

  const choose = async (file: File) => {
    Object.defineProperty(fileInput(), 'files', { value: [file], configurable: true });
    fileInput().dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };
  const file = (type: string, size = 1000) => {
    const f = new File(['x'], 'pic', { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  beforeEach(() => {
    Object.values(users).forEach((m) => m.mockReset());
    out.updated = [];
    out.closed = 0;
    TestBed.configureTestingModule({ providers: [{ provide: UserService, useValue: users }] });
  });

  it('opens filled in with the current bio and privacy setting', async () => {
    await create(profile({ bio: 'Hello there', likesPublic: true }));
    expect(bio().value).toBe('Hello there');
    expect(toggle().checked).toBe(true);
  });

  it('counts down the characters left in the bio', async () => {
    await create(profile({ bio: 'abc' }));
    expect(el.textContent).toContain('197 characters left');
  });

  describe('saving', () => {
    it('sends the trimmed bio and the privacy switch, reports the result and closes', async () => {
      const result: ProfileEdit = { bio: 'New bio', avatarUrl: '/avatars/a.jpg', likesPublic: true };
      users.updateProfile.mockReturnValue(of(result));
      await create();

      bio().value = '  New bio  ';
      bio().dispatchEvent(new Event('input'));
      toggle().click();
      await fixture.whenStable();
      save().click();
      await fixture.whenStable();

      expect(users.updateProfile).toHaveBeenCalledWith('New bio', true);
      expect(out.updated).toEqual([result]);
      expect(out.closed).toBe(1);
    });

    it('stays open and keeps what was typed when saving fails', async () => {
      users.updateProfile.mockReturnValue(throwError(() => ({ status: 400, error: 'Bio can be at most 200 characters.' })));
      await create();
      bio().value = 'something';
      bio().dispatchEvent(new Event('input'));

      save().click();
      await fixture.whenStable();

      expect(error()).toContain('at most 200');
      expect(bio().value).toBe('something');
      expect(out.closed).toBe(0);
    });

    it('cannot be submitted twice at once, and disables Save for an over-long bio', async () => {
      users.updateProfile.mockReturnValue(new Subject<ProfileEdit>());
      await create();
      save().click();
      await fixture.whenStable();
      save().click();
      expect(users.updateProfile).toHaveBeenCalledTimes(1);
      expect(save().textContent).toContain('Saving');

      await create();
      bio().value = 'x'.repeat(201);
      bio().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(save().disabled).toBe(true);
    });
  });

  describe('profile picture', () => {
    it('uploads as soon as one is chosen, then shows it and reports it', async () => {
      const result: ProfileEdit = { bio: 'Old bio', avatarUrl: '/avatars/new.jpg', likesPublic: false };
      users.uploadAvatar.mockReturnValue(of(result));
      await create();

      const picture = file('image/png');
      await choose(picture);

      expect(users.uploadAvatar).toHaveBeenCalledWith(picture);
      expect(out.updated).toEqual([result]);
      expect(el.querySelector('img')!.getAttribute('src')).toBe('http://localhost:5080/avatars/new.jpg');
      expect(out.closed).toBe(0); // you can keep editing
    });

    it('rejects the wrong kind of file, or a huge one, before uploading anything', async () => {
      await create();

      await choose(file('image/gif'));
      expect(error()).toContain('JPEG, PNG or WebP');

      await choose(file('image/png', 6 * 1024 * 1024));
      expect(error()).toContain('too large');
      expect(users.uploadAvatar).not.toHaveBeenCalled();
    });

    it('shows the server\'s reason when it refuses the image', async () => {
      users.uploadAvatar.mockReturnValue(throwError(() => ({ status: 400, error: 'That file couldn\'t be read as an image.' })));
      await create();
      await choose(file('image/png'));
      expect(error()).toContain("couldn't be read");
    });

    it('can remove the picture, and only offers to when there is one', async () => {
      users.removeAvatar.mockReturnValue(of({ bio: 'Old bio', avatarUrl: null, likesPublic: false }));
      await create();

      (el.querySelector('.link') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(users.removeAvatar).toHaveBeenCalled();
      expect(el.querySelector('.link')).toBeNull();
      expect(el.querySelector('img')).toBeNull();

      await create(profile({ avatarUrl: null }));
      expect(el.querySelector('.link')).toBeNull();
    });
  });

  it('closes with Escape or a click on the backdrop, but not from a click inside the dialog', async () => {
    await create();
    (el.querySelector('.dialog') as HTMLElement).click();
    expect(out.closed).toBe(0);

    (el.querySelector('.backdrop') as HTMLElement).click();
    expect(out.closed).toBe(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(out.closed).toBe(2);
  });
});
