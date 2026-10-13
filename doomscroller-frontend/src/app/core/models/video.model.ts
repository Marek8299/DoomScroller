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
}

export interface UserProfile {
  username: string;
  createdAtUtc: string;
  videoCount: number;
}
