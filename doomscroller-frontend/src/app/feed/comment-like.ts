import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { formatCount } from '../core/format-count';
import { AuthService } from '../core/services/auth.service';
import { CommentService } from '../core/services/comment.service';

/** A small heart + count beside a comment. Instant, rolls back on failure, sends signed-out visitors to log in. */
@Component({
  selector: 'app-comment-like',
  template: `
    <button
      type="button"
      [class.liked]="liked()"
      [attr.aria-label]="liked() ? 'Unlike comment' : 'Like comment'"
      [attr.aria-pressed]="liked()"
      (click)="toggle()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 4.5 6.6 4.5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.8 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
    <span class="count">{{ shownCount() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center; // heart and count on one line, so a short comment never leaves the count hanging below
      gap: 1px;
      flex: none;
      color: #aaa;
      font-size: 0.8rem;
    }

    button {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: none;
      border: none;
      border-radius: 50%;
      cursor: pointer;

      svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: #aaa;
        stroke-width: 2;
      }

      &.liked svg {
        fill: #fe2c55;
        stroke: #fe2c55;
      }

      &:focus-visible {
        outline: 2px solid #fff;
      }
    }

    .count {
      min-width: 1ch;
    }
  `
})
export class CommentLike {
  private readonly comments = inject(CommentService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly videoId = input.required<string>();
  readonly commentId = input.required<string>();
  readonly count = input.required<number>();
  readonly likedByMe = input.required<boolean>();

  // Local copies that update instantly and reset to the server's values when the inputs change.
  protected readonly liked = linkedSignal(() => this.likedByMe());
  private readonly total = linkedSignal(() => this.count());
  protected readonly shownCount = () => formatCount(this.total());

  private readonly busy = signal(false);

  protected toggle(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.busy()) return;

    const wasLiked = this.liked();
    this.apply(!wasLiked);
    this.busy.set(true);

    const request = wasLiked
      ? this.comments.unlike(this.videoId(), this.commentId())
      : this.comments.like(this.videoId(), this.commentId());
    request.subscribe({
      next: (state) => {
        this.liked.set(state.liked);
        this.total.set(state.likeCount);
        this.busy.set(false);
      },
      error: (err) => {
        this.apply(wasLiked); // roll back
        this.busy.set(false);
        if (err?.status === 401) {
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
