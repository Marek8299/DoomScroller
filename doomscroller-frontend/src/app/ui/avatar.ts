import { Component, computed, input, signal } from '@angular/core';
import { mediaUrl } from '../core/media-url';

/** A round profile picture, or the user's initial on a colour derived from their name when there's none. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (src(); as source) {
      <img [src]="source" alt="" (error)="failed.set(true)" />
    } @else {
      <span class="initial" [style.background]="colour()" [style.font-size.px]="size() * 0.45">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-block;
      border-radius: 50%;
      overflow: hidden;
      flex: none;
      line-height: 0;
    }

    img,
    .initial {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .initial {
      display: grid;
      place-items: center;
      color: #fff;
      font-weight: 700;
      line-height: 1;
      text-transform: uppercase;
    }
  `,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' }
})
export class Avatar {
  readonly username = input.required<string>();
  /** Path the API gave us ("/avatars/x.jpg"), or null/undefined for none. */
  readonly url = input<string | null | undefined>(null);
  readonly size = input(40);

  protected readonly failed = signal(false);
  // A picture that fails to load (deleted, offline) quietly falls back to the initial.
  protected readonly src = computed(() => (this.failed() ? null : mediaUrl(this.url())));
  protected readonly initial = computed(() => this.username().charAt(0) || '?');
  protected readonly colour = computed(() => {
    let hash = 0;
    for (const ch of this.username()) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${hash}, 55%, 38%)`;
  });
}
