import { Component, inject } from '@angular/core';
import { PlaybackPreferences } from '../core/services/playback-preferences';

/** Mute/unmute for the whole feed. Lives in the action column, not inside the player. */
@Component({
  selector: 'app-mute-button',
  template: `
    <button
      type="button"
      [attr.aria-label]="prefs.muted() ? 'Unmute' : 'Mute'"
      [attr.aria-pressed]="prefs.muted()"
      (click)="prefs.toggleMuted()"
    >
      @if (prefs.muted()) {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3z" />
          <path d="m16.5 9.5 5 5m0-5-5 5" stroke-width="2" stroke-linecap="round" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3z" />
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2" stroke-linecap="round" />
        </svg>
      }
    </button>
  `,
  styleUrl: './action-button.scss'
})
export class MuteButton {
  protected readonly prefs = inject(PlaybackPreferences);
}
