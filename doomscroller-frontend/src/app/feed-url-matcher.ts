import { UrlMatcher, UrlSegment } from '@angular/router';

/**
 * One route for both "/" and "/v/:id", so the feed component is *reused* (not rebuilt and reloaded)
 * when the address bar moves from one to the other as you scroll.
 */
export const feedUrlMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 2 && segments[0].path === 'v') {
    return { consumed: segments, posParams: { id: segments[1] } };
  }
  return null;
};
