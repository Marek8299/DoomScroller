import { Injectable, signal } from '@angular/core';

/**
 * Playback choices shared by every video in the feed. Mute lives here (not on each <video>) so the
 * mute button, the video in view and the ones scrolled to next always agree.
 *
 * Starts muted on every page load on purpose: browsers refuse unmuted autoplay until the user has
 * interacted with the page. Tapping the unmute button is that interaction, after which the
 * following videos can play with sound.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackPreferences {
  readonly muted = signal(true);

  toggleMuted(): void {
    this.muted.update((m) => !m);
  }
}
