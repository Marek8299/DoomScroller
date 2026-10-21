import { Component, ElementRef, Injector, OnInit, afterNextRender, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileEdit, UserProfile } from '../core/models/video.model';
import { UserService } from '../core/services/user.service';
import { Avatar } from '../ui/avatar';

// Mirror the backend (ProfileRules / AvatarService), which is the real authority.
const MAX_BIO = 200;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Edit your own profile: picture, bio, and whether others can see what you've liked. The picture is
 * saved the moment you choose it (it's its own upload); bio and the privacy switch save together.
 * Every successful change is reported through `updated` so the page behind stays current.
 */
@Component({
  selector: 'app-edit-profile-dialog',
  imports: [ReactiveFormsModule, Avatar],
  templateUrl: './edit-profile-dialog.html',
  styleUrl: './edit-profile-dialog.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' }
})
export class EditProfileDialog implements OnInit {
  private readonly users = inject(UserService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly profile = input.required<UserProfile>();

  readonly updated = output<ProfileEdit>();
  readonly closed = output<void>();

  protected readonly avatarUrl = signal<string | null>(null);
  protected readonly avatarBusy = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly maxBio = MAX_BIO;

  protected readonly form = this.fb.group({
    bio: ['', Validators.maxLength(MAX_BIO)],
    likesPublic: [false]
  });

  ngOnInit(): void {
    // Filled in once, when the dialog opens.
    const p = this.profile();
    this.avatarUrl.set(p.avatarUrl);
    this.form.setValue({ bio: p.bio ?? '', likesPublic: p.likesPublic });
    afterNextRender(() => this.host.querySelector<HTMLElement>('.dialog')?.focus(), { injector: this.injector });
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still triggers a change
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type)) {
      this.error.set('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.error.set('That image is too large (5 MB maximum).');
      return;
    }

    this.runAvatar(this.users.uploadAvatar(file));
  }

  protected removeAvatar(): void {
    this.runAvatar(this.users.removeAvatar());
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.error.set(undefined);

    const { bio, likesPublic } = this.form.getRawValue();
    this.users.updateProfile(bio.trim(), likesPublic).subscribe({
      next: (edit) => {
        this.saving.set(false);
        this.updated.emit(edit);
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false); // keep the form as it is so nothing typed is lost
        this.error.set(this.messageFor(err, "Couldn't save your profile. Please try again."));
      }
    });
  }

  private runAvatar(request: ReturnType<UserService['uploadAvatar']>): void {
    this.avatarBusy.set(true);
    this.error.set(undefined);
    request.subscribe({
      next: (edit) => {
        this.avatarBusy.set(false);
        this.avatarUrl.set(edit.avatarUrl);
        this.updated.emit(edit);
      },
      error: (err) => {
        this.avatarBusy.set(false);
        this.error.set(this.messageFor(err, "Couldn't update your picture. Please try again."));
      }
    });
  }

  private messageFor(err: { status?: number; error?: unknown }, fallback: string): string {
    if (err?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return typeof err?.error === 'string' && err.error ? err.error : fallback;
  }
}
