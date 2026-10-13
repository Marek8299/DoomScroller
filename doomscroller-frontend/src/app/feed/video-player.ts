import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { PlaybackPreferences } from '../core/services/playback-preferences';
import { AutoPlayInView } from './auto-play-in-view';
import { formatTime, progressPercent, seekTimeFromKey, seekTimeFromPointer } from './seek';

/**
 * One feed video with our own controls instead of the browser's:
 *  - tap the video to pause/resume,
 *  - mute button on the right edge (thumb-reachable; state is shared across the whole feed),
 *  - a thin progress bar along the bottom that you can tap, drag or use with the arrow keys to seek.
 */
@Component({
  selector: 'app-video-player',
  imports: [AutoPlayInView],
  templateUrl: './video-player.html',
  styleUrl: './video-player.scss'
})
export class VideoPlayer {
  protected readonly prefs = inject(PlaybackPreferences);

  readonly src = input.required<string>();

  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly currentTime = signal(0);
  protected readonly duration = signal(NaN);
  protected readonly paused = signal(true);
  protected readonly scrubbing = signal(false);

  protected readonly percent = computed(() => progressPercent(this.currentTime(), this.duration()));
  protected readonly valueText = computed(() => `${formatTime(this.currentTime())} of ${formatTime(this.duration())}`);

  protected onTimeUpdate(): void {
    this.currentTime.set(this.video.currentTime);
  }

  protected onMetadata(): void {
    this.duration.set(this.video.duration);
  }

  protected togglePlay(): void {
    const video = this.video;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  protected toggleMute(): void {
    this.prefs.toggleMuted();
  }

  // --- seek bar -------------------------------------------------------------------------------

  protected onSeekPointerDown(event: PointerEvent): void {
    if (!(this.duration() > 0)) return;
    // Keep receiving move/up events even when the finger or cursor leaves the thin bar.
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.scrubbing.set(true);
    this.seekToPointer(event);
  }

  protected onSeekPointerMove(event: PointerEvent): void {
    if (this.scrubbing()) this.seekToPointer(event);
  }

  protected onSeekPointerEnd(event: PointerEvent): void {
    if (!this.scrubbing()) return;
    this.scrubbing.set(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  protected onSeekKeyDown(event: KeyboardEvent): void {
    const target = seekTimeFromKey(event.key, this.video.currentTime, this.video.duration);
    if (target === null) return;
    event.preventDefault();
    this.seekTo(target);
  }

  private seekToPointer(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.seekTo(seekTimeFromPointer(event.clientX, rect.left, rect.width, this.video.duration));
  }

  private seekTo(seconds: number): void {
    this.video.currentTime = seconds;
    this.currentTime.set(seconds); // reflect it immediately; timeupdate can lag behind a drag
  }

  private get video(): HTMLVideoElement {
    return this.videoRef().nativeElement;
  }
}
