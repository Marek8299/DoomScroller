import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { formatCount } from '../core/format-count';
import { mediaUrl } from '../core/media-url';
import { FollowState, LikedItem, ProfileComment, ProfileEdit, UserProfile, VideoItem } from '../core/models/video.model';
import { PagedList } from '../core/paged-list';
import { timeAgo } from '../core/time-ago';
import { UserService } from '../core/services/user.service';
import { VideoService } from '../core/services/video.service';
import { Avatar } from '../ui/avatar';
import { CommentRow } from './comment-row';
import { EditProfileDialog } from './edit-profile-dialog';
import { FollowButton } from './follow-button';
import { VideoGrid } from './video-grid';

type TabId = 'videos' | 'comments' | 'liked';
const VIDEO_PAGE = 12;
const LIST_PAGE = 20;

/**
 * A person's page: picture, name, follower count, bio, a big Follow (or Edit profile) button, and
 * tabs for their videos, their comments and what they've liked. Tabs load the first time they're opened.
 */
@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, Avatar, FollowButton, VideoGrid, CommentRow, EditProfileDialog],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss'
})
export class ProfilePage {
  private readonly users = inject(UserService);
  private readonly videoService = inject(VideoService);
  private readonly router = inject(Router);

  /** From the route: /u/:username */
  readonly username = input.required<string>();

  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly failure = signal<'not-found' | 'error' | null>(null);

  protected readonly tab = signal<TabId>('videos');
  protected readonly editing = signal(false);

  protected readonly videos = new PagedList<VideoItem>(
    (skip) => this.videoService.getUserVideos(this.username(), skip, VIDEO_PAGE), VIDEO_PAGE);
  protected readonly comments = new PagedList<ProfileComment>(
    (skip) => this.users.getComments(this.username(), skip, LIST_PAGE), LIST_PAGE);
  protected readonly liked = new PagedList<LikedItem>(
    (skip) => this.users.getLikes(this.username(), skip, LIST_PAGE), LIST_PAGE);

  /** "Liked" is only offered when the viewer is allowed to see it. */
  protected readonly tabs = computed<{ id: TabId; label: string }[]>(() => [
    { id: 'videos', label: 'Videos' },
    { id: 'comments', label: 'Comments' },
    ...(this.profile()?.likesVisible ? [{ id: 'liked' as TabId, label: 'Liked' }] : [])
  ]);

  protected readonly followers = computed(() => formatCount(this.profile()?.followerCount ?? 0));
  protected readonly totalLikes = computed(() => formatCount(this.profile()?.likeCount ?? 0));

  protected readonly thumb = (v: VideoItem) => mediaUrl(v.thumbnailUrl);
  protected readonly ago = timeAgo;

  constructor() {
    // Loads when the page opens and again whenever the username in the address changes (moving
    // between profiles reuses this component); switchMap drops a slow answer for the previous person.
    toObservable(this.username)
      .pipe(
        tap(() => {
          this.profile.set(null);
          this.loading.set(true);
          this.failure.set(null);
          this.tab.set('videos');
          this.editing.set(false);
          [this.videos, this.comments, this.liked].forEach((list) => list.reset());
        }),
        switchMap((name) =>
          this.users.getProfile(name).pipe(
            catchError((err) => {
              this.failure.set(err?.status === 404 ? 'not-found' : 'error');
              return of(null);
            })
          )
        )
      )
      .subscribe((profile) => {
        this.loading.set(false);
        this.profile.set(profile);
        if (profile) this.videos.start();
      });
  }

  protected selectTab(id: TabId): void {
    this.tab.set(id);
    ({ videos: this.videos, comments: this.comments, liked: this.liked })[id].start();
  }

  /** Left/Right (and Home/End) move between tabs, as people expect from a tab bar. */
  protected onTabKey(event: KeyboardEvent): void {
    const ids = this.tabs().map((t) => t.id);
    const index = ids.indexOf(this.tab());
    const next =
      event.key === 'ArrowRight' ? (index + 1) % ids.length
      : event.key === 'ArrowLeft' ? (index - 1 + ids.length) % ids.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? ids.length - 1
      : -1;
    if (next < 0) return;

    event.preventDefault();
    this.selectTab(ids[next]);
    // Keep keyboard focus on the tab that just became active.
    queueMicrotask(() => document.getElementById(`tab-${ids[next]}`)?.focus());
  }

  protected onFollowChanged(state: FollowState): void {
    this.profile.update((p) => (p ? { ...p, followerCount: state.followerCount, isFollowing: state.following } : p));
  }

  protected onProfileEdited(edit: ProfileEdit): void {
    this.profile.update((p) => (p ? { ...p, bio: edit.bio, avatarUrl: edit.avatarUrl, likesPublic: edit.likesPublic } : p));
  }

  /** Where a liked video should open: in its author's feed when known. */
  protected videoLink(video: VideoItem): string[] {
    return video.author ? ['/u', video.author.username, 'v', video.id] : ['/v', video.id];
  }

  protected retry(): void {
    // Re-run the page's load by navigating to the same URL isn't possible; reload the data directly.
    this.loading.set(true);
    this.failure.set(null);
    this.users.getProfile(this.username()).pipe(catchError(() => of(null))).subscribe((profile) => {
      this.loading.set(false);
      this.profile.set(profile);
      if (!profile) this.failure.set('error');
      else this.videos.start();
    });
  }
}
