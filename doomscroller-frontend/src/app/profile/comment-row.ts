import { Component, input } from '@angular/core';
import { formatCount } from '../core/format-count';
import { timeAgo } from '../core/time-ago';

/**
 * A comment as listed on a profile: the text, which video it's on, when, and its likes.
 * Display only for now, so it has no links or buttons.
 */
@Component({
  selector: 'app-comment-row',
  template: `
    <article class="row">
      @if (authorUsername(); as author) {
        <div class="author">&#64;{{ author }}</div>
      }
      <p class="text">{{ text() }}</p>
      <p class="context">
        on <strong>{{ videoTitle() }}</strong>@if (videoAuthor(); as owner) { by &#64;{{ owner }}} &middot; {{ ago() }}
        &middot; <span aria-label="likes">&#9825; {{ likes() }}</span>
      </p>
    </article>
  `,
  styles: `
    .row {
      padding: 14px 4px;
      border-bottom: 1px solid #222;
    }

    .author {
      margin-bottom: 2px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.4;
      white-space: pre-wrap; // keep the line breaks people typed
      overflow-wrap: anywhere;
    }

    .context {
      margin: 6px 0 0;
      font-size: 0.8rem;
      color: #888;

      strong {
        color: #bbb;
        font-weight: 600;
      }
    }
  `
})
export class CommentRow {
  readonly text = input.required<string>();
  readonly createdAtUtc = input.required<string>();
  readonly likeCount = input.required<number>();
  readonly videoTitle = input.required<string>();
  readonly videoAuthor = input<string | null>(null);
  /** Shown when the comment isn't the profile owner's own (the Liked tab). */
  readonly authorUsername = input<string | null>(null);

  protected readonly ago = () => timeAgo(this.createdAtUtc());
  protected readonly likes = () => formatCount(this.likeCount());
}
