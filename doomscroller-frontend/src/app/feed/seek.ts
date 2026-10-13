/** Pure helpers for the player's seek bar, kept free of DOM/Angular so they're trivially testable. */

export const KEY_SEEK_SECONDS = 5;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Where in the video (seconds) a pointer at `clientX` lands on a bar that starts at `left` and is `width` wide. */
export function seekTimeFromPointer(clientX: number, left: number, width: number, duration: number): number {
  if (!(duration > 0) || !(width > 0)) return 0;
  return clamp((clientX - left) / width, 0, 1) * duration;
}

/** New playback position for a seek-bar key press, or null if the key isn't one we handle. */
export function seekTimeFromKey(key: string, current: number, duration: number): number | null {
  if (!(duration > 0)) return null;
  switch (key) {
    case 'ArrowLeft':
      return clamp(current - KEY_SEEK_SECONDS, 0, duration);
    case 'ArrowRight':
      return clamp(current + KEY_SEEK_SECONDS, 0, duration);
    case 'Home':
      return 0;
    case 'End':
      return duration;
    default:
      return null;
  }
}

/** Playback progress as a 0-100 percentage; 0 while the duration is still unknown (NaN/Infinity before metadata loads). */
export function progressPercent(current: number, duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? clamp((current / duration) * 100, 0, 100) : 0;
}

/** "m:ss" for the slider's accessible value text. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
