import { DestroyRef, Directive, ElementRef, OnInit, inject } from '@angular/core';

/**
 * Plays the <video> while it's mostly on screen and pauses it as soon as it scrolls away,
 * so only the video you're looking at ever plays (TikTok-style).
 *
 * Browsers only allow unmuted autoplay after the user has interacted with the page, so videos
 * start muted. Once the user unmutes one via the native controls, that choice sticks for the
 * videos that follow (falling back to muted if the browser still refuses).
 */
@Directive({
  selector: 'video[appAutoPlayInView]'
})
export class AutoPlayInView implements OnInit {
  /** Shared across all videos so unmuting once carries over to the next one. */
  private static muted = true;

  private readonly video = inject<ElementRef<HTMLVideoElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const video = this.video;

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? this.play() : this.pause()),
      { threshold: 0.6 } // "current" = at least 60% visible
    );
    observer.observe(video);

    const onVolumeChange = () => (AutoPlayInView.muted = video.muted);
    video.addEventListener('volumechange', onVolumeChange);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      video.removeEventListener('volumechange', onVolumeChange);
    });
  }

  private async play(): Promise<void> {
    const video = this.video;
    video.muted = AutoPlayInView.muted;
    try {
      await video.play();
    } catch {
      // Unmuted autoplay blocked: retry muted rather than leaving the video paused.
      video.muted = true;
      await video.play().catch(() => undefined);
    }
  }

  private pause(): void {
    this.video.pause();
    this.video.currentTime = 0; // start from the top when you scroll back to it
  }
}
