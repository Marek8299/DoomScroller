export type ContainerFormat = 'Mp4' | 'Mkv';
export type RenditionStatus = 'Queued' | 'Processing' | 'Ready' | 'Failed';

export interface VideoRendition {
  id: string;
  height: number;
  isOriginalResolution: boolean;
  container: ContainerFormat;
  videoCodec: string;
  audioCodec: string;
  sizeBytes: number;
  status: RenditionStatus;
  url: string;
}

export interface VideoProbe {
  width: number;
  height: number;
  durationSeconds: number;
}

export interface Author {
  username: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  uploadedAtUtc: string;
  status: RenditionStatus;
  /** Only present for the author's own videos. */
  errorMessage?: string;
  probe?: VideoProbe;
  /** Missing for videos uploaded before accounts existed. */
  author?: Author;
  renditions: VideoRendition[];
  likeCount: number;
  /** Whether the signed-in viewer has liked it (always false when signed out). */
  likedByMe: boolean;
  commentCount: number;
  /** True when the signed-in viewer is this video's author (may edit/delete it). */
  isOwner: boolean;
  /** Preview image; null for videos that predate thumbnails or whose thumbnail couldn't be made. */
  thumbnailUrl?: string | null;
}

export interface CommentItem {
  id: string;
  text: string;
  createdAtUtc: string;
  author: Author;
  /** True for the comment's author and for the author of the video it's on. */
  canDelete: boolean;
  likeCount: number;
  likedByMe: boolean;
}

export interface UserProfile {
  username: string;
  createdAtUtc: string;
  videoCount: number;
  /** Total likes across their videos. */
  likeCount: number;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  isFollowing: boolean;
  /** The viewer is looking at their own profile. */
  isSelf: boolean;
  /** May the viewer see the Liked tab? (Always for the owner; for others only if the owner allows it.) */
  likesVisible: boolean;
  /** The owner's setting; only ever true for the owner themselves. */
  likesPublic: boolean;
}

export interface FollowState {
  followerCount: number;
  following: boolean;
}

export interface VideoRef {
  id: string;
  title: string;
  authorUsername: string | null;
}

export interface ProfileComment {
  id: string;
  text: string;
  createdAtUtc: string;
  likeCount: number;
  likedByMe: boolean;
  video: VideoRef;
}

export interface LikedComment {
  id: string;
  text: string;
  createdAtUtc: string;
  author: Author;
  likeCount: number;
  likedByMe: boolean;
  video: VideoRef;
}

/** One entry of the Liked tab: a video or a comment, depending on `type`. */
export interface LikedItem {
  type: 'video' | 'comment';
  likedAtUtc: string;
  video: VideoItem | null;
  comment: LikedComment | null;
}

/** What changed after editing your own profile. */
export interface ProfileEdit {
  bio: string | null;
  avatarUrl: string | null;
  likesPublic: boolean;
}

export interface LikeState {
  likeCount: number;
  liked: boolean;
}
