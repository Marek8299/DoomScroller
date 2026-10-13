import { DestroyRef, Directive, ElementRef, OnInit, inject } from '@angular/core';
import { PlaybackPreferences } from '../core/services/playback-preferences';

/**
 * Plays the <video> while it's mostly on screen and pauses it as soon as it scrolls away,
 * so only the video you're looking at ever plays (TikTok-style).
 *
 * Mute is shared through PlaybackPreferences. If the browser still refuses to autoplay with
 * sound, the shared state is flipped back to muted (so the mute button tells the truth) and
 * playback retries muted rather than leaving the video paused.
 */
@Directive({
  selector: 'video[appAutoPlayInView]'
})
export class AutoPlayInView implements OnInit {
  private readonly video = inject<ElementRef<HTMLVideoElement>>(ElementRef).nativeElement;
  private readonly prefs = inject(PlaybackPreferences);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? this.play() : this.pause()),
      { threshold: 0.6 } // "current" = at least 60% visible
    );
    observer.observe(this.video);

    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private async play(): Promise<void> {
    const video = this.video;
    video.muted = this.prefs.muted();
    try {
      await video.play();
    } catch {
      this.prefs.muted.set(true);
      video.muted = true;
      await video.play().catch(() => undefined);
    }
  }

  private pause(): void {
    this.video.pause();
    this.video.currentTime = 0; // start from the top when you scroll back to it
  }
}
