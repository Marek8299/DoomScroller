import { Component, input, output } from '@angular/core';
import { formatCount } from '../core/format-count';

/** Speech-bubble + count in the action column; pressing it asks the feed to open the comments panel. */
@Component({
  selector: 'app-comment-button',
  template: `
    <button type="button" aria-label="Comments" (click)="pressed.emit()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      </svg>
    </button>
    <span class="count">{{ shownCount() }}</span>
  `,
  styleUrl: './action-button.scss'
})
export class CommentButton {
  readonly count = input.required<number>();
  readonly pressed = output<void>();

  protected readonly shownCount = () => formatCount(this.count());
}
