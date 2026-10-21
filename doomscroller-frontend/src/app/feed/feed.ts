import { Component, DestroyRef, computed, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, catchError, forkJoin, map, of, switchMap, tap, throwError, timer } from 'rxjs';
import { VideoService } from '../core/services/video.service';
import { VideoItem } from '../core/models/video.model';
import { CommentButton } from './comment-button';
import { CommentsPanel } from './comments-panel';
import { EditVideoPanel } from './edit-video-panel';
import { InView } from './in-view';
import { LikeButton } from './like-button';
import { MuteButton } from './mute-button';
import { OwnerMenu } from './owner-menu';
import { ShareButton } from './share-button';
import { VideoPlayer } from './video-player';

/**
 * The scrolling video feed. At "/" it shows everyone's videos. At "/v/:id" (a shared link) it opens
 * on that video and carries on with the normal feed below it. At "/u/:username/v/:id" (a video
 * picked from someone's profile) it opens on that video and carries on with that author's videos.
 * The router binds the URL parts to the inputs.
 */
@Component({
  selector: 'app-feed',
  imports: [RouterLink, VideoPlayer, InView, LikeButton, CommentButton, ShareButton, CommentsPanel, EditVideoPanel, OwnerMenu, MuteButton],
  templateUrl: './feed.html',
  styleUrl: './feed.scss'
})
export class Feed {
  private readonly videoService = inject(VideoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /** Set when watching one author's videos (from their profile), undefined on the main feed. */
  readonly username = input<string>();

  /**
   * Set at "/v/:id": the video a shared link points at, shown first. Only its value when the feed
   * *loads* counts. As you scroll, the address bar is updated to the video in view, which changes
   * this input but must not reload the feed.
   */
  readonly videoId = input<string | undefined>(undefined, { alias: 'id' });

  /** Why a shared link didn't open its video (deleted, or never public), shown as a small notice. */
  protected readonly notice = signal<string | undefined>(undefined);

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

  /** Each video paired with the rendition URL the feed should play. */
  protected readonly items = computed(() =>
    this.videos().map((video) => ({ video, src: this.bestRenditionUrl(video) }))
  );

  constructor() {
    // One pipeline for: first load, 8s polling (so new uploads appear once processed), and
    // switching between feeds. switchMap cancels the old feed's requests when the page changes.
    toObservable(computed(() => ({ name: this.username(), pinnedId: untracked(this.videoId) })))
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(undefined);
          this.notice.set(undefined);
          this.videos.set([]);
        }),
        switchMap(({ name, pinnedId }) =>
          timer(0, 8000).pipe(
            switchMap(() =>
              this.fetch(name, pinnedId).pipe(
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
  }

  /** The panel posted or deleted a comment: keep the button's count in step until the next refresh. */
  protected setCommentCount(videoId: string, count: number): void {
    this.videos.update((list) => list.map((v) => (v.id === videoId ? { ...v, commentCount: count } : v)));
  }

  /**
   * The address bar follows the video you're watching, starting with the very first one, so copying
   * it always shares the right video. When watching one author's videos the address keeps that
   * context (/u/name/v/id), so reloading or going Back behaves as you'd expect.
   */
  protected onInView(videoId: string): void {
    if (this.videoId() === videoId) return;

    const username = this.username();
    const target = username ? ['/u', username, 'v', videoId] : ['/v', videoId];
    // replaceUrl: moving between videos must not fill the browser's Back history.
    void this.router.navigate(target, { replaceUrl: true });
  }

  private fetch(username: string | undefined, pinnedId: string | undefined): Observable<VideoItem[]> {
    const list$ = username ? this.videoService.getUserVideos(username, 0, 20) : this.videoService.getFeed(0, 20);
    if (!pinnedId) return list$;

    // Opened on one particular video: that video first, then the rest (without a second copy of it).
    return forkJoin({
      pinned: this.videoService.getById(pinnedId).pipe(
        catchError((err) => (err?.status === 404 ? of(null) : throwError(() => err)))
      ),
      list: list$
    }).pipe(
      tap(({ pinned }) =>
        this.notice.set(pinned ? undefined : "That video isn't available. It may have been deleted.")
      ),
      map(({ pinned, list }) => (pinned ? [pinned, ...list.filter((v) => v.id !== pinned.id)] : list))
    );
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
