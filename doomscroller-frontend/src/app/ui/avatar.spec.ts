import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';

describe('Avatar', () => {
  async function render(inputs: { username: string; url?: string | null; size?: number }) {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('username', inputs.username);
    if (inputs.url !== undefined) fixture.componentRef.setInput('url', inputs.url);
    if (inputs.size !== undefined) fixture.componentRef.setInput('size', inputs.size);
    await fixture.whenStable();
    return fixture;
  }

  it('shows the picture, from the API host, when there is one', async () => {
    const fixture = await render({ username: 'marek', url: '/avatars/abc.jpg' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('http://localhost:5080/avatars/abc.jpg');
    expect(fixture.nativeElement.querySelector('.initial')).toBeNull();
  });

  it('falls back to the first letter of the name when there is no picture', async () => {
    const fixture = await render({ username: 'marek', url: null });
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.initial').textContent.trim()).toBe('m');
  });

  it('falls back to the letter when the picture fails to load', async () => {
    const fixture = await render({ username: 'zed', url: '/avatars/gone.jpg' });
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.initial').textContent.trim()).toBe('z');
  });

  it('gives the same person the same colour every time, and different people usually different ones', async () => {
    const colour = async (name: string) =>
      ((await render({ username: name })).nativeElement.querySelector('.initial') as HTMLElement).style.background;
    expect(await colour('marek')).toBe(await colour('marek'));
    expect(await colour('marek')).not.toBe(await colour('alice'));
  });

  it('is as big as asked', async () => {
    const fixture = await render({ username: 'marek', size: 104 });
    expect((fixture.nativeElement as HTMLElement).style.width).toBe('104px');
    expect((fixture.nativeElement as HTMLElement).style.height).toBe('104px');
  });
});
