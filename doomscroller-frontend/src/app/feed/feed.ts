import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, switchMap } from 'rxjs';
import { VideoService } from '../core/services/video.service';
import { VideoItem } from '../core/models/video.model';
import { AutoPlayInView } from './auto-play-in-view';

@Component({
  selector: 'app-feed',
  imports: [RouterLink, AutoPlayInView],
  templateUrl: './feed.html',
  styleUrl: './feed.scss'
})
export class Feed implements OnInit {
  private readonly videoService = inject(VideoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly videos = signal<VideoItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | undefined>(undefined);

  /** Each video paired with the rendition URL the feed should play. */
  protected readonly items = computed(() =>
    this.videos().map((video) => ({ video, src: this.bestRenditionUrl(video) }))
  );

  ngOnInit(): void {
    this.loadFeed();

    // Cheap poll so freshly-uploaded videos appear once transcoding finishes,
    // without wiring up SignalR for a small demo app.
    interval(8000)
      .pipe(
        switchMap(() => this.videoService.getFeed(0, 20)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({ next: (videos) => this.videos.set(videos) });
  }

  private loadFeed(): void {
    this.loading.set(true);
    this.videoService.getFeed(0, 20).subscribe({
      next: (videos) => {
        this.videos.set(videos);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Could not reach the DoomScroller API. Is the backend running?');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  /** Picks the smallest ready rendition >= 720p if one exists, else the best available. */
  private bestRenditionUrl(video: VideoItem): string | null {
    const ready = video.renditions.filter((r) => r.status === 'Ready');
    if (ready.length === 0) return null;
    const hd = [...ready].filter((r) => r.height >= 720).sort((a, b) => a.height - b.height)[0];
    const chosen = hd ?? [...ready].sort((a, b) => b.height - a.height)[0];
    return this.videoService.mediaUrl(chosen.url);
  }
}
