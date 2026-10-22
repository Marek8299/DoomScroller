import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, output, signal, viewChild } from '@angular/core';

/**
 * The "..." beside a comment's age. Today it holds one action, Delete (the parent asks "are you
 * sure?" afterwards); other actions can join it later. The menu is positioned against the viewport, so
 * the comment list's own scrolling can't clip it, and closes if you scroll or resize.
 */
@Component({
  selector: 'app-comment-menu',
  template: `
    <button
      #trigger
      type="button"
      class="more"
      aria-label="Comment options"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
      </svg>
    </button>

    @if (open()) {
      <div
        class="menu"
        role="menu"
        [style.top.px]="position().top"
        [style.bottom.px]="position().bottom"
        [style.right.px]="position().right"
      >
        <button type="button" role="menuitem" class="item danger" (click)="choose()">Delete</button>
      </div>
    }
  `,
  styleUrl: './comment-menu.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:resize)': 'close()',
    // On the host (not the document) so that, with the menu open, Escape can be handled here and
    // stopped before it reaches the comments sheet's own Escape handler, which would close the sheet.
    '(keydown.escape)': 'onEscape($event)'
  }
})
export class CommentMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  /** The Delete item was chosen. */
  readonly deleteRequested = output<void>();

  protected readonly open = signal(false);
  protected readonly position = signal<{ top: number | null; bottom: number | null; right: number }>({
    top: 0,
    bottom: null,
    right: 0
  });

  constructor() {
    // Scroll events don't bubble, so listen in the capture phase to catch the comment list scrolling.
    const onScroll = () => this.close();
    document.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }

    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const right = Math.max(8, viewportWidth - rect.right);
    // Open downwards, unless there's no room below: then open upwards.
    this.position.set(
      viewportHeight - rect.bottom < 72
        ? { top: null, bottom: viewportHeight - rect.top + 4, right }
        : { top: rect.bottom + 4, bottom: null, right }
    );
    this.open.set(true);
    afterNextRender(() => this.host.querySelector<HTMLElement>('.item')?.focus(), { injector: this.injector });
  }

  protected choose(): void {
    this.close();
    this.deleteRequested.emit();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) this.close();
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return; // closed: let the sheet handle Escape as usual
    event.stopPropagation();
    this.close();
    this.trigger().nativeElement.focus();
  }

  protected close(): void {
    this.open.set(false);
  }
}
