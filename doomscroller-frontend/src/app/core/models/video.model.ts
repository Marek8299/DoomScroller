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
}

export interface CommentItem {
  id: string;
  text: string;
  createdAtUtc: string;
  author: Author;
  /** True for the comment's author and for the author of the video it's on. */
  canDelete: boolean;
}

export interface UserProfile {
  username: string;
  createdAtUtc: string;
  videoCount: number;
  /** Total likes across their videos. */
  likeCount: number;
}

export interface LikeState {
  likeCount: number;
  liked: boolean;
}
