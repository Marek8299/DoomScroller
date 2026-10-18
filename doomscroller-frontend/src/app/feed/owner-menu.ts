import { Component, ElementRef, Injector, afterNextRender, inject, input, output, signal } from '@angular/core';
import { VideoService } from '../core/services/video.service';

/**
 * The "..." button for the video's author: Edit, or Delete (asked about first, since it can't be
 * undone). Deleting happens here; editing is handed to the feed, which opens the edit sheet.
 */
@Component({
  selector: 'app-owner-menu',
  template: `
    <button
      type="button"
      class="more"
      aria-label="Video options"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      </svg>
    </button>

    @if (open()) {
      <div class="menu" role="menu">
        @if (!confirming()) {
          <button type="button" role="menuitem" class="item" (click)="startEdit()">Edit</button>
          <button type="button" role="menuitem" class="item danger" (click)="askDelete()">Delete&hellip;</button>
        } @else {
          <div class="confirm" role="group" aria-label="Confirm deleting this video">
            <p>Delete this video? Its comments and likes will be deleted too. This can't be undone.</p>
            <div class="buttons">
              <button type="button" class="cancel" [disabled]="busy()" (click)="cancelDelete()">Cancel</button>
              <button type="button" class="confirm-delete" [disabled]="busy()" (click)="confirmDelete()">
                {{ busy() ? 'Deleting…' : 'Delete' }}
              </button>
            </div>
          </div>
        }

        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </div>
    }
  `,
  styleUrl: './owner-menu.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class OwnerMenu {
  private readonly videos = inject(VideoService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly videoId = input.required<string>();

  /** The author chose Edit. */
  readonly edit = output<void>();
  /** The video is gone (deleted here, or it already was). */
  readonly deleted = output<void>();

  protected readonly open = signal(false);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.open.set(true);
    }
  }

  protected startEdit(): void {
    this.close();
    this.edit.emit();
  }

  protected askDelete(): void {
    this.error.set(undefined);
    this.confirming.set(true);
    // Focus the safe choice, so a stray Enter or Space can't delete the video.
    afterNextRender(() => this.host.querySelector<HTMLButtonElement>('.cancel')?.focus(), { injector: this.injector });
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
    this.error.set(undefined);
  }

  protected confirmDelete(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(undefined);

    this.videos.delete(this.videoId()).subscribe({
      next: () => this.finishDeleted(),
      error: (err) => {
        this.busy.set(false);
        if (err?.status === 404) {
          this.finishDeleted(); // already gone: the outcome you wanted
        } else if (err?.status === 403 || err?.status === 401) {
          this.error.set("You can't delete this video.");
        } else {
          this.error.set("Couldn't delete the video. Please try again.");
        }
      }
    });
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) this.close();
  }

  /** Escape backs out one level at a time: the delete question, then the menu. */
  protected onEscape(): void {
    if (this.confirming()) {
      this.cancelDelete();
    } else if (this.open()) {
      this.close();
    }
  }

  private finishDeleted(): void {
    this.busy.set(false);
    this.close();
    this.deleted.emit();
  }

  private close(): void {
    this.open.set(false);
    this.confirming.set(false);
    this.error.set(undefined);
  }
}
