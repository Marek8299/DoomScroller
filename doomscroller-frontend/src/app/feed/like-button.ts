import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { formatCount } from '../core/format-count';
import { AuthService } from '../core/services/auth.service';
import { VideoService } from '../core/services/video.service';

/**
 * Heart + count for one video. Updates instantly (optimistically) and rolls back if the server
 * says no. Signed-out visitors are sent to the login page instead, then back here.
 */
@Component({
  selector: 'app-like-button',
  template: `
    <button
      type="button"
      class="heart"
      [class.liked]="liked()"
      [attr.aria-label]="liked() ? 'Unlike' : 'Like'"
      [attr.aria-pressed]="liked()"
      (click)="toggle()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 4.5 6.6 4.5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.8 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
    <span class="count">{{ shownCount() }}</span>
  `,
  styleUrl: './action-button.scss'
})
export class LikeButton {
  private readonly videos = inject(VideoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly videoId = input.required<string>();
  /** Server truth, re-supplied whenever the feed refreshes. */
  readonly count = input.required<number>();
  readonly likedByMe = input.required<boolean>();

  // Local, instantly-updating copies that reset to the server's values when the inputs change.
  protected readonly liked = linkedSignal(() => this.likedByMe());
  private readonly total = linkedSignal(() => this.count());
  protected readonly shownCount = () => formatCount(this.total());

  private readonly busy = signal(false);

  protected toggle(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.busy()) return; // one request at a time; a rapid double-tap can't desync the count

    const wasLiked = this.liked();
    this.apply(!wasLiked);
    this.busy.set(true);

    const request = wasLiked ? this.videos.unlike(this.videoId()) : this.videos.like(this.videoId());
    request.subscribe({
      next: (state) => {
        this.liked.set(state.liked); // the server's answer wins (handles likes from other people too)
        this.total.set(state.likeCount);
        this.busy.set(false);
      },
      error: (err) => {
        this.apply(wasLiked); // roll the optimistic change back
        this.busy.set(false);
        if (err?.status === 401) {
          // Session expired while the page was open.
          this.auth.user.set(null);
          this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        }
      }
    });
  }

  private apply(liked: boolean): void {
    this.total.update((n) => Math.max(0, n + (liked ? 1 : -1)));
    this.liked.set(liked);
  }
}
