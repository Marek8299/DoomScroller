import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, of, switchMap, tap, timer } from 'rxjs';
import { VideoService } from '../core/services/video.service';
import { VideoItem } from '../core/models/video.model';
import { CommentButton } from './comment-button';
import { CommentsPanel } from './comments-panel';
import { EditVideoPanel } from './edit-video-panel';
import { LikeButton } from './like-button';
import { MuteButton } from './mute-button';
import { OwnerMenu } from './owner-menu';
import { VideoPlayer } from './video-player';

/**
 * The scrolling video feed. At "/" it shows everyone's videos; at "/u/:username" the same
 * component shows one author's videos (the router binds :username to the `username` input).
 */
@Component({
  selector: 'app-feed',
  imports: [RouterLink, VideoPlayer, LikeButton, CommentButton, CommentsPanel, EditVideoPanel, OwnerMenu, MuteButton],
  templateUrl: './feed.html',
  styleUrl: './feed.scss'
})
export class Feed {
  private readonly videoService = inject(VideoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Set on author pages, undefined on the home feed. */
  readonly username = input<string>();

  protected readonly videos = signal<VideoItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | undefined>(undefined);

  /** Which video's comments panel is open (only one sheet is ever open at a time). */
  protected readonly openComments = signal<string | null>(null);

  /** Which video's edit sheet is open. */
  protected readonly editing = signal<string | null>(null);

  /**
   * Videos deleted in this session. A poll that was already in flight when you deleted one would
   * otherwise bring it back until the next refresh, so refreshes are filtered through this.
   */
  private readonly deletedIds = new Set<string>();

  /** Bumped after a delete so the profile header (video count, likes) is fetched again. */
  private readonly profileRefresh = signal(0);

  /** Each video paired with the rendition URL the feed should play. */
  protected readonly items = computed(() =>
    this.videos().map((video) => ({ video, src: this.bestRenditionUrl(video) }))
  );

  /** Header info for author pages (null on the home feed or if the user doesn't exist). */
  protected readonly profile = toSignal(
    toObservable(computed(() => ({ name: this.username(), refresh: this.profileRefresh() }))).pipe(
      switchMap(({ name }) =>
        name ? this.videoService.getProfile(name).pipe(catchError(() => of(null))) : of(null)
      )
    ),
    { initialValue: null }
  );

  constructor() {
    // One pipeline for: first load, 8s polling (so new uploads appear once processed), and
    // switching between feeds. switchMap cancels the old feed's requests when the page changes.
    toObservable(this.username)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(undefined);
          this.videos.set([]);
        }),
        switchMap((name) =>
          timer(0, 8000).pipe(
            switchMap(() =>
              this.fetch(name).pipe(
                catchError((err) => {
                  this.error.set(
                    err?.status === 404
                      ? 'No such user.'
                      : 'Could not reach the DoomScroller API. Is the backend running?'
                  );
                  this.loading.set(false);
                  console.error(err);
                  return EMPTY;
                })
              )
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((videos) => {
        this.videos.set(videos.filter((v) => !this.deletedIds.has(v.id)));
        this.loading.set(false);
      });
  }

  protected toggleComments(videoId: string): void {
    this.editing.set(null);
    this.openComments.update((open) => (open === videoId ? null : videoId));
  }

  protected startEdit(videoId: string): void {
    this.openComments.set(null);
    this.editing.set(videoId);
  }

  /** The edit sheet saved: swap in the server's version (it carries the up-to-date counts too). */
  protected onSaved(updated: VideoItem): void {
    this.videos.update((list) => list.map((v) => (v.id === updated.id ? updated : v)));
    this.editing.set(null);
  }

  protected onDeleted(videoId: string): void {
    this.deletedIds.add(videoId);
    this.videos.update((list) => list.filter((v) => v.id !== videoId));
    this.openComments.set(null);
    this.editing.set(null);
    this.profileRefresh.update((n) => n + 1);
  }

  /** The panel posted or deleted a comment: keep the button's count in step until the next refresh. */
  protected setCommentCount(videoId: string, count: number): void {
    this.videos.update((list) => list.map((v) => (v.id === videoId ? { ...v, commentCount: count } : v)));
  }

  private fetch(username: string | undefined): Observable<VideoItem[]> {
    return username ? this.videoService.getUserVideos(username, 0, 20) : this.videoService.getFeed(0, 20);
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
