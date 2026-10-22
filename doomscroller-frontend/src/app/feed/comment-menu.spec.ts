import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentMenu } from './comment-menu';

describe('CommentMenu', () => {
  let fixture: ComponentFixture<CommentMenu>;
  let el: HTMLElement;
  let deleteRequests = 0;

  const q = (s: string) => el.querySelector(s) as HTMLElement | null;
  const trigger = () => q('.more') as HTMLButtonElement;
  const open = async () => {
    trigger().click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    deleteRequests = 0;
    fixture = TestBed.createComponent(CommentMenu);
    fixture.componentInstance.deleteRequested.subscribe(() => deleteRequests++);
    await fixture.whenStable();
    el = fixture.nativeElement;
    document.body.appendChild(el); // focus, outside clicks and bubbling to the document need it in the page
  });

  it('is a closed, accessible menu button to begin with', () => {
    expect(q('.menu')).toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('Comment options');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens with a Delete item, focuses it, and reflects the state for assistive technology', async () => {
    await open();
    expect(q('.menu')!.getAttribute('role')).toBe('menu');
    expect(q('.item')!.textContent!.trim()).toBe('Delete');
    expect(document.activeElement).toBe(q('.item'));
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('choosing Delete reports it and closes the menu', async () => {
    await open();
    q('.item')!.click();
    await fixture.whenStable();
    expect(deleteRequests).toBe(1);
    expect(q('.menu')).toBeNull();
  });

  it('pressing the button again closes it', async () => {
    await open();
    await open();
    expect(q('.menu')).toBeNull();
  });

  it('closes when you click elsewhere, but not when you click inside the menu', async () => {
    await open();
    q('.menu')!.click();
    await fixture.whenStable();
    expect(q('.menu')).not.toBeNull();

    document.body.click();
    await fixture.whenStable();
    expect(q('.menu')).toBeNull();
  });

  describe('Escape', () => {
    it('closes the menu, returns focus to its button, and does NOT reach the document (so the sheet stays open)', async () => {
      const documentSaw = vi.fn();
      document.addEventListener('keydown', documentSaw);
      await open();

      q('.item')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(q('.menu')).toBeNull();
      expect(document.activeElement).toBe(trigger());
      expect(documentSaw).not.toHaveBeenCalled();
      document.removeEventListener('keydown', documentSaw);
    });

    it('is left alone when the menu is closed, so it can close the sheet', async () => {
      const documentSaw = vi.fn();
      document.addEventListener('keydown', documentSaw);

      trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(documentSaw).toHaveBeenCalledTimes(1);
      document.removeEventListener('keydown', documentSaw);
    });
  });

  it('closes when the page is resized or anything scrolls (the menu is positioned against the viewport)', async () => {
    await open();
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    expect(q('.menu')).toBeNull();

    await open();
    document.dispatchEvent(new Event('scroll')); // captured from any scrolling element
    await fixture.whenStable();
    expect(q('.menu')).toBeNull();
  });

  describe('placement', () => {
    const placeButtonAt = (rect: Partial<DOMRect>) => {
      trigger().getBoundingClientRect = () => ({ top: 0, left: 0, width: 28, height: 28, x: 0, y: 0, toJSON: () => ({}), ...rect }) as DOMRect;
    };

    beforeEach(() => {
      // jsdom has no real viewport; give it one.
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });
    });

    it('opens below the button, right edges aligned', async () => {
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      placeButtonAt({ top: 100, bottom: 128, right: 300 });
      await open();

      const menu = q('.menu')!;
      expect(menu.style.top).toBe('132px'); // 4px under the button
      expect(menu.style.bottom).toBe('');
      expect(menu.style.right).toBe('700px'); // 1000 - 300
    });

    it('never lets the menu touch the screen edge', async () => {
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      placeButtonAt({ top: 100, bottom: 128, right: 995 });
      await open();
      expect(q('.menu')!.style.right).toBe('8px'); // would be 5px, kept at a minimum margin
    });

    it('opens above the button when there is no room below', async () => {
      Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
      placeButtonAt({ top: 760, bottom: 788, right: 300 });
      await open();

      const menu = q('.menu')!;
      expect(menu.style.top).toBe('');
      expect(menu.style.bottom).toBe('44px'); // 800 - 760 + 4
    });
  });
});
