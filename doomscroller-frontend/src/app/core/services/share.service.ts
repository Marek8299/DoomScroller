import { Injectable, inject } from '@angular/core';
import { copyToClipboard } from '../clipboard';
import { ToastService } from './toast.service';

export interface Shareable {
  id: string;
  title: string;
  authorName?: string;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly toast = inject(ToastService);

  /** The public address of a video, built from wherever the app is served (respecting <base href>). */
  videoUrl(videoId: string): string {
    return new URL(`v/${videoId}`, document.baseURI).toString();
  }

  /**
   * Share a video: the device's own share menu when the browser has one, otherwise copy the link and say so.
   * Must be called straight from a click, because browsers only allow the share menu in response to one.
   */
  async shareVideo(video: Shareable): Promise<void> {
    const data: ShareData = {
      title: video.title,
      text: video.authorName
        ? `${video.title} by @${video.authorName} on DoomScroller`
        : `${video.title} on DoomScroller`,
      url: this.videoUrl(video.id)
    };

    if (typeof navigator.share === 'function' && (navigator.canShare?.(data) ?? true)) {
      try {
        await navigator.share(data);
        return; // the share menu is its own feedback
      } catch (error) {
        // Closing the menu without choosing anything is a decision, not a failure.
        if ((error as DOMException)?.name === 'AbortError') return;
        // Anything else (blocked, unsupported target...): fall back to copying the link.
      }
    }

    const copied = await copyToClipboard(data.url!);
    this.toast.show(copied ? 'Link copied to clipboard' : "Couldn't copy the link");
  }
}
