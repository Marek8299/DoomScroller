import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackPreferences } from '../core/services/playback-preferences';
import { VideoPlayer } from './video-player';

/** jsdom has no media playback, so give the <video> just enough behaviour for the player to drive. */
function fakeMedia(video: HTMLVideoElement, duration: number) {
  let currentTime = 0;
  let paused = true;
  Object.defineProperty(video, 'duration', { get: () => duration, configurable: true });
  Object.defineProperty(video, 'currentTime', { get: () => currentTime, set: (v: number) => (currentTime = v), configurable: true });
  Object.defineProperty(video, 'paused', { get: () => paused, configurable: true });
  video.play = vi.fn(async () => {
    paused = false;
    video.dispatchEvent(new Event('play'));
  });
  video.pause = vi.fn(() => {
    paused = true;
    video.dispatchEvent(new Event('pause'));
  });
}

describe('VideoPlayer', () => {
  let fixture: ComponentFixture<VideoPlayer>;
  let el: HTMLElement;
  let video: HTMLVideoElement;
  let prefs: PlaybackPreferences;

  beforeEach(async () => {
    // The autoplay directive observes visibility; jsdom has no IntersectionObserver.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );

    await TestBed.configureTestingModule({ imports: [VideoPlayer] }).compileComponents();
    fixture = TestBed.createComponent(VideoPlayer);
    fixture.componentRef.setInput('src', 'http://localhost/video.mp4');
    await fixture.whenStable();

    el = fixture.nativeElement;
    video = el.querySelector('video')!;
    prefs = TestBed.inject(PlaybackPreferences);
    fakeMedia(video, 100);
    video.dispatchEvent(new Event('loadedmetadata'));
    await fixture.whenStable();
  });

  const seekBar = () => el.querySelector<HTMLElement>('.seek')!;
  const muteButton = () => el.querySelector<HTMLButtonElement>('.mute')!;

  it('has no native controls', () => {
    expect(video.hasAttribute('controls')).toBe(false);
  });

  it('starts muted, and the button toggles the shared mute state and its label', async () => {
    expect(video.muted).toBe(true);
    expect(muteButton().getAttribute('aria-label')).toBe('Unmute');

    muteButton().click();
    await fixture.whenStable();

    expect(prefs.muted()).toBe(false);
    expect(video.muted).toBe(false);
    expect(muteButton().getAttribute('aria-label')).toBe('Mute');
  });

  it('follows the shared mute state when another part of the app changes it', async () => {
    prefs.muted.set(false);
    await fixture.whenStable();
    expect(video.muted).toBe(false);
  });

  it('tapping the video toggles play/pause and shows a play hint while paused', async () => {
    expect(el.querySelector('.play-hint')).not.toBeNull();

    video.click();
    await fixture.whenStable();
    expect(video.play).toHaveBeenCalled();
    expect(el.querySelector('.play-hint')).toBeNull();

    video.click();
    await fixture.whenStable();
    expect(video.pause).toHaveBeenCalled();
    expect(el.querySelector('.play-hint')).not.toBeNull();
  });

  it('shows playback progress on the bar and in the slider semantics', async () => {
    video.currentTime = 25;
    video.dispatchEvent(new Event('timeupdate'));
    await fixture.whenStable();

    expect(el.querySelector<HTMLElement>('.seek-fill')!.style.width).toBe('25%');
    expect(seekBar().getAttribute('aria-valuenow')).toBe('25');
    expect(seekBar().getAttribute('aria-valuemax')).toBe('100');
    expect(seekBar().getAttribute('aria-valuetext')).toBe('0:25 of 1:40');
  });

  it('seeks to where the bar is pressed and keeps following a drag', async () => {
    // 200px wide bar starting at x=50
    seekBar().getBoundingClientRect = () => ({ left: 50, width: 200, right: 250, top: 0, bottom: 28, height: 28, x: 50, y: 0, toJSON: () => ({}) });
    seekBar().setPointerCapture = vi.fn();
    seekBar().releasePointerCapture = vi.fn();
    const pointer = (type: string, clientX: number) =>
      seekBar().dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, clientX }), { pointerId: 1 }));

    pointer('pointerdown', 150); // halfway
    expect(video.currentTime).toBe(50);

    pointer('pointermove', 200); // three quarters
    expect(video.currentTime).toBe(75);

    pointer('pointermove', 9999); // dragged past the end clamps
    expect(video.currentTime).toBe(100);

    pointer('pointerup', 9999);
    pointer('pointermove', 100); // no longer scrubbing: ignored
    expect(video.currentTime).toBe(100);
    expect(seekBar().releasePointerCapture).toHaveBeenCalled();
  });

  it('seeks with the arrow keys, Home and End', async () => {
    video.currentTime = 50;
    const key = (k: string) => seekBar().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

    key('ArrowRight');
    expect(video.currentTime).toBe(55);
    key('ArrowLeft');
    key('ArrowLeft');
    expect(video.currentTime).toBe(45);
    key('End');
    expect(video.currentTime).toBe(100);
    key('Home');
    expect(video.currentTime).toBe(0);
  });

  it('ignores seek presses until the duration is known', async () => {
    Object.defineProperty(video, 'duration', { get: () => NaN, configurable: true });
    video.dispatchEvent(new Event('durationchange'));
    await fixture.whenStable();

    seekBar().setPointerCapture = vi.fn();
    seekBar().dispatchEvent(Object.assign(new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }), { pointerId: 1 }));
    expect(video.currentTime).toBe(0);
    expect(seekBar().setPointerCapture).not.toHaveBeenCalled();
  });
});
