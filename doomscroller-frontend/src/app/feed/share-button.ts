import { Component, inject, input } from '@angular/core';
import { ShareService } from '../core/services/share.service';
import { VideoItem } from '../core/models/video.model';

/** Share arrow in the action column. */
@Component({
  selector: 'app-share-button',
  template: `
    <button type="button" aria-label="Share" (click)="share()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3v5.2C7.4 8.8 3.5 12.7 3 20c2.4-3.7 5.6-5.5 11-5.7V19l8-8z" />
      </svg>
    </button>
    <span class="count">Share</span>
  `,
  styleUrl: './action-button.scss'
})
export class ShareButton {
  private readonly shares = inject(ShareService);

  readonly video = input.required<VideoItem>();

  protected share(): void {
    const video = this.video();
    void this.shares.shareVideo({ id: video.id, title: video.title, authorName: video.author?.username });
  }
}
