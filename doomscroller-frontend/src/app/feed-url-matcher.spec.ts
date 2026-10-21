import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlSegment, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { feedUrlMatcher } from './feed-url-matcher';

const segs = (...paths: string[]) => paths.map((p) => new UrlSegment(p, {}));
const match = (...paths: string[]) => feedUrlMatcher(segs(...paths), null as never, null as never);

describe('feedUrlMatcher', () => {
  it('matches the root', () => {
    expect(match()).toEqual({ consumed: [] });
  });

  it('matches /v/:id and captures the id', () => {
    const result = match('v', 'abc-123');
    expect(result?.consumed).toHaveLength(2);
    expect(result?.posParams?.['id'].path).toBe('abc-123');
  });

  it('matches /u/:username/v/:id (a video opened from a profile) and captures both parts', () => {
    const result = match('u', 'marek', 'v', 'abc-123');
    expect(result?.consumed).toHaveLength(4);
    expect(result?.posParams?.['username'].path).toBe('marek');
    expect(result?.posParams?.['id'].path).toBe('abc-123');
  });

  it('leaves a bare /u/:username to the profile page', () => {
    expect(match('u', 'marek')).toBeNull();
    expect(match('u', 'marek', 'v')).toBeNull();
    expect(match('u', 'marek', 'videos', 'abc')).toBeNull();
  });

  it('matches nothing else', () => {
    expect(match('v')).toBeNull(); // no id
    expect(match('v', 'a', 'b')).toBeNull(); // too deep
    expect(match('u', 'someone')).toBeNull(); // author pages have their own route
    expect(match('upload')).toBeNull();
    expect(match('login')).toBeNull();
  });
});

@Component({ selector: 'app-probe', template: '' })
class Probe {
  static created = 0;
  readonly id = input<string>();
  constructor() {
    Probe.created++;
  }
}

describe('feed route', () => {
  it('reuses the same component when the URL moves between / and /v/:id, which is what keeps the feed from reloading while you scroll', async () => {
    Probe.created = 0;
    TestBed.configureTestingModule({
      providers: [provideRouter([{ matcher: feedUrlMatcher, component: Probe }], withComponentInputBinding())]
    });
    const harness = await RouterTestingHarness.create('/');
    const first = harness.routeDebugElement!.componentInstance as Probe;
    expect(first.id()).toBeUndefined();

    await TestBed.inject(Router).navigate(['/v', 'second'], { replaceUrl: true });
    harness.detectChanges();
    expect(harness.routeDebugElement!.componentInstance).toBe(first); // same instance, not rebuilt
    expect(first.id()).toBe('second'); // the new id arrives through the input
    expect(Probe.created).toBe(1);

    await TestBed.inject(Router).navigate(['/v', 'third'], { replaceUrl: true });
    harness.detectChanges();
    expect(first.id()).toBe('third');
    expect(Probe.created).toBe(1);

    await TestBed.inject(Router).navigate(['/']);
    harness.detectChanges();
    expect(first.id()).toBeUndefined();
    expect(Probe.created).toBe(1);
  });

  it('opening a shared link directly gives the component that id from the start', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ matcher: feedUrlMatcher, component: Probe }], withComponentInputBinding())]
    });
    const harness = await RouterTestingHarness.create('/v/shared-1');
    expect((harness.routeDebugElement!.componentInstance as Probe).id()).toBe('shared-1');
  });
});
