export type EncodingPreset = 'LowestSize' | 'Conservative' | 'WebOptimized';
export type ContainerFormat = 'Mp4' | 'Mkv';
export type RenditionStatus = 'Queued' | 'Processing' | 'Ready' | 'Failed';

export interface ConversionOptions {
  preset: EncodingPreset;
  container: ContainerFormat;
  forceCopyAudioIfSupported: boolean;
  /** "original" or a comma-separated list like "480,720,1080,2160" */
  resolutionTargets: string;
}

export interface VideoRendition {
  id: string;
  height: number;
  isOriginalResolution: boolean;
  container: ContainerFormat;
  videoCodec: string;
  audioCodec: string;
  audioWasCopied: boolean;
  usedHardwareEncoder: boolean;
  fileName: string;
  sizeBytes: number;
  status: RenditionStatus;
  errorMessage?: string;
  url: string;
}

export interface VideoProbeResult {
  width: number;
  height: number;
  durationSeconds: number;
  videoCodec?: string;
  audioCodec?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  originalFileName: string;
  uploadedAtUtc: string;
  options: ConversionOptions;
  status: RenditionStatus;
  errorMessage?: string;
  probe?: VideoProbeResult;
  renditions: VideoRendition[];
}
