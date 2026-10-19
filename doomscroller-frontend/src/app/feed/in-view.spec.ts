import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InView } from './in-view';

@Component({ imports: [InView], template: '<div (appInView)="count = count + 1"></div>' })
class Host {
  count = 0;
}

describe('InView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits only when the element is at least 60% visible, and stops observing when destroyed', async () => {
    let callback!: (entries: { isIntersecting: boolean }[]) => void;
    const disconnect = vi.fn();
    let options: IntersectionObserverInit | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof callback, opts: IntersectionObserverInit) {
          callback = cb;
          options = opts;
        }
        observe() {}
        disconnect = disconnect;
      }
    );

    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(options?.threshold).toBe(0.6);

    callback([{ isIntersecting: false }]);
    expect(fixture.componentInstance.count).toBe(0);
    callback([{ isIntersecting: true }]);
    expect(fixture.componentInstance.count).toBe(1);

    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
