import { Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FollowState, UserProfile } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { UserService } from '../core/services/user.service';

/**
 * The big button under the bio. On someone else's profile: Follow / Following. On your own: Edit profile.
 * Follow updates instantly and rolls back if the server refuses; the page holding the profile applies
 * every `followChanged` it receives.
 */
@Component({
  selector: 'app-follow-button',
  template: `
    @if (profile().isSelf) {
      <button type="button" class="big secondary" (click)="editRequested.emit()">Edit profile</button>
    } @else {
      <button
        type="button"
        class="big"
        [class.secondary]="profile().isFollowing"
        [attr.aria-pressed]="profile().isFollowing"
        (click)="toggle()"
      >
        {{ profile().isFollowing ? 'Following' : 'Follow' }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 340px;
    }

    .big {
      width: 100%;
      min-height: 52px; // generously sized: it's the page's main action
      padding: 0 24px;
      border: 1px solid #fe2c55;
      border-radius: 10px;
      background: #fe2c55;
      color: #fff;
      font: inherit;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;

      &.secondary {
        background: transparent;
        border-color: #555;
        color: #fff;
      }

      &:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
    }
  `
})
export class FollowButton {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly profile = input.required<UserProfile>();

  readonly followChanged = output<FollowState>();
  readonly editRequested = output<void>();

  private readonly busy = signal(false);

  protected toggle(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.busy()) return; // one request at a time, so a rapid double-tap can't desync the count

    const before = this.profile();
    const wasFollowing = before.isFollowing;
    this.followChanged.emit({ followerCount: Math.max(0, before.followerCount + (wasFollowing ? -1 : 1)), following: !wasFollowing });
    this.busy.set(true);

    const request = wasFollowing ? this.users.unfollow(before.username) : this.users.follow(before.username);
    request.subscribe({
      next: (state) => {
        this.followChanged.emit(state); // the server's answer wins
        this.busy.set(false);
      },
      error: (err) => {
        this.followChanged.emit({ followerCount: before.followerCount, following: wasFollowing }); // roll back
        this.busy.set(false);
        if (err?.status === 401) {
          this.auth.user.set(null); // the session expired while the page was open
          this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        }
      }
    });
  }
}
