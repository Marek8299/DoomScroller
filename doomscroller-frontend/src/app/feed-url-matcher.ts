import { UrlMatchResult, UrlMatcher, UrlSegment } from '@angular/router';

/**
 * One route for "/", "/v/:id" and "/u/:username/v/:id", so the feed component is *reused* (not
 * rebuilt and reloaded) when the address bar moves between them as you scroll. ("/u/:username" on
 * its own is the profile page, a separate route.)
 */
export const feedUrlMatcher: UrlMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 2 && segments[0].path === 'v') {
    return { consumed: segments, posParams: { id: segments[1] } };
  }
  if (segments.length === 4 && segments[0].path === 'u' && segments[2].path === 'v') {
    return { consumed: segments, posParams: { username: segments[1], id: segments[3] } };
  }
  return null;
};
