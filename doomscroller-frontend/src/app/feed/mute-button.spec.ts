import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlaybackPreferences } from '../core/services/playback-preferences';
import { MuteButton } from './mute-button';

describe('MuteButton', () => {
  it('toggles the shared mute state and its label', async () => {
    const fixture = TestBed.createComponent(MuteButton);
    await fixture.whenStable();
    const prefs = TestBed.inject(PlaybackPreferences);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(prefs.muted()).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Unmute');

    button.click();
    await fixture.whenStable();
    expect(prefs.muted()).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Mute');

    button.click();
    await fixture.whenStable();
    expect(prefs.muted()).toBe(true);
  });
});
