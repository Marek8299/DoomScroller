import { environment } from '../../environments/environment';

/** Turns a path the API hands out ("/avatars/x.jpg", "/thumbs/y.jpg") into a full URL the browser can load. */
export function mediaUrl(path: string | null | undefined): string | null {
  return path ? `${environment.mediaBaseUrl}${path}` : null;
}
