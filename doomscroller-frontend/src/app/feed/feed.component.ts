import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { interval, Subscription, switchMap } from 'rxjs';
import { VideoService } from '../core/services/video.service';
import { VideoItem } from '../core/models/video.model';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss'
})
export class FeedComponent implements OnInit {
  videos: VideoItem[] = [];
  loading = true;
  error?: string;
  private pollSub?: Subscription;

  constructor(private readonly videoService: VideoService) {}

  ngOnInit(): void {
    this.loadFeed();
    // Cheap poll so freshly-uploaded videos appear once transcoding finishes,
    // without wiring up SignalR for a small demo app.
    this.pollSub = interval(8000)
      .pipe(switchMap(() => this.videoService.getFeed(0, 20)))
      .subscribe({ next: (videos) => (this.videos = videos) });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadFeed(): void {
    this.loading = true;
    this.videoService.getFeed(0, 20).subscribe({
      next: (videos) => {
        this.videos = videos;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Could not reach the DoomScroller API. Is the backend running?';
        this.loading = false;
        console.error(err);
      }
    });
  }

  /** Picks the smallest ready rendition >= 720p if one exists, else the best available. */
  bestRenditionUrl(video: VideoItem): string | null {
    const ready = video.renditions.filter((r) => r.status === 'Ready');
    if (ready.length === 0) return null;
    const hd = ready.filter((r) => r.height >= 720).sort((a, b) => a.height - b.height)[0];
    const chosen = hd ?? ready.sort((a, b) => b.height - a.height)[0];
    return this.videoService.mediaUrl(chosen.url);
  }

  trackByVideoId(_index: number, video: VideoItem): string {
    return video.id;
  }
}
