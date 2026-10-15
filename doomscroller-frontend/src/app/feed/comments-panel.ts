import { Component, OnInit, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommentItem } from '../core/models/video.model';
import { AuthService } from '../core/services/auth.service';
import { CommentService } from '../core/services/comment.service';
import { formatCount } from '../core/format-count';
import { timeAgo } from '../core/time-ago';

const PAGE_SIZE = 20;
export const MAX_COMMENT_LENGTH = 500; // mirrors CommentRules.MaxLength on the backend

/** Bottom sheet over a video: its comments (newest first), a box to add one, delete where allowed. */
@Component({
  selector: 'app-comments-panel',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './comments-panel.html',
  styleUrl: './comments-panel.scss',
  host: { '(document:keydown.escape)': 'closed.emit()' }
})
export class CommentsPanel implements OnInit {
  private readonly api = inject(CommentService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly videoId = input.required<string>();
  /** The video's comment total as the feed knows it. */
  readonly count = input.required<number>();

  readonly closed = output<void>();
  /** Tells the feed the total changed (we posted or deleted one), so the button's count follows. */
  readonly countChange = output<number>();

  protected readonly comments = signal<CommentItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly loadError = signal<string | undefined>(undefined);
  protected readonly actionError = signal<string | undefined>(undefined);
  protected readonly posting = signal(false);

  protected readonly maxLength = MAX_COMMENT_LENGTH;
  protected readonly input = new FormControl('', { nonNullable: true });
  private readonly typed = toSignal(this.input.valueChanges, { initialValue: '' });
  protected readonly canSend = computed(() => this.typed().trim().length > 0 && !this.posting());
  protected readonly remaining = computed(() => MAX_COMMENT_LENGTH - this.typed().length);

  /**
   * Our own running total. It follows the `count` input (so a feed refresh corrects it), but every
   * post/delete adjusts it right here instead of waiting for the parent to feed the new number back
   * in, which is what makes rolling back a failed delete exact.
   */
  private readonly total = linkedSignal(() => this.count());

  protected readonly title = computed(() => {
    const n = this.total();
    return `${formatCount(n)} ${n === 1 ? 'comment' : 'comments'}`;
  });

  protected readonly loginQuery = () => ({ returnUrl: this.router.url });
  protected readonly timeAgo = (iso: string) => timeAgo(iso);

  ngOnInit(): void {
    this.api.getComments(this.videoId(), 0, PAGE_SIZE).subscribe({
      next: (page) => {
        this.comments.set(page);
        this.hasMore.set(page.length === PAGE_SIZE);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set("Couldn't load comments.");
        this.loading.set(false);
      }
    });
  }

  protected loadMore(): void {
    if (this.loadingMore()) return;
    this.loadingMore.set(true);

    // Everything shown (including ones we just posted, which sort first) is the first N of the
    // server's order, so N is the right offset for the next page.
    this.api.getComments(this.videoId(), this.comments().length, PAGE_SIZE).subscribe({
      next: (page) => {
        const known = new Set(this.comments().map((c) => c.id));
        this.comments.update((list) => [...list, ...page.filter((c) => !known.has(c.id))]);
        this.hasMore.set(page.length === PAGE_SIZE);
        this.loadingMore.set(false);
      },
      error: () => {
        this.actionError.set("Couldn't load more comments.");
        this.loadingMore.set(false);
      }
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    const text = this.input.value.trim();
    if (!text || this.posting()) return;

    this.posting.set(true);
    this.actionError.set(undefined);

    this.api.post(this.videoId(), text).subscribe({
      next: (comment) => {
        this.comments.update((list) => [comment, ...list]);
        this.input.reset('');
        this.posting.set(false);
        this.setTotal(this.total() + 1);
      },
      error: (err) => {
        this.posting.set(false); // the text stays in the box so nothing typed is lost
        if (err?.status === 401) {
          this.auth.user.set(null);
          this.actionError.set('Please log in again to comment.');
        } else if (err?.status === 429) {
          this.actionError.set("You're commenting too fast. Try again in a moment.");
        } else {
          this.actionError.set(typeof err?.error === 'string' && err.error ? err.error : "Couldn't post your comment.");
        }
      }
    });
  }

  protected remove(comment: CommentItem): void {
    const index = this.comments().findIndex((c) => c.id === comment.id);
    if (index < 0) return;

    this.actionError.set(undefined);
    this.comments.update((list) => list.filter((c) => c.id !== comment.id)); // optimistic
    this.setTotal(this.total() - 1);

    this.api.delete(this.videoId(), comment.id).subscribe({
      error: () => {
        this.comments.update((list) => [...list.slice(0, index), comment, ...list.slice(index)]);
        this.setTotal(this.total() + 1);
        this.actionError.set("Couldn't delete that comment.");
      }
    });
  }

  private setTotal(n: number): void {
    this.total.set(n);
    this.countChange.emit(n);
  }
}
