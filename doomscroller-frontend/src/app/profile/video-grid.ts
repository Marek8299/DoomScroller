import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCount } from '../core/format-count';
import { mediaUrl } from '../core/media-url';
import { VideoItem } from '../core/models/video.model';

/** Thumbnails in a 3-column grid; opening one starts the feed on that video. */
@Component({
  selector: 'app-video-grid',
  imports: [RouterLink],
  template: `
    <ul class="grid">
      @for (video of videos(); track video.id) {
        <li>
          <a class="cell" [routerLink]="linkFor(video)" [attr.aria-label]="video.title">
            @if (thumb(video); as src) {
              <img [src]="src" alt="" loading="lazy" />
            } @else {
              <span class="placeholder" aria-hidden="true">&#9654;</span>
            }

            @if (video.status !== 'Ready') {
              <span class="badge">{{ video.status === 'Failed' ? 'Failed' : 'Processing' }}</span>
            }
            <span class="likes" aria-hidden="true">&#9825; {{ count(video.likeCount) }}</span>
            <span class="title">{{ video.title }}</span>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: './video-grid.scss'
})
export class VideoGrid {
  readonly videos = input.required<VideoItem[]>();

  protected readonly count = formatCount;
  protected thumb = (video: VideoItem) => mediaUrl(video.thumbnailUrl);

  /** Stay in the author's context when we know them: /u/name/v/id; otherwise the plain /v/id. */
  protected linkFor(video: VideoItem): string[] {
    return video.author ? ['/u', video.author.username, 'v', video.id] : ['/v', video.id];
  }
}
