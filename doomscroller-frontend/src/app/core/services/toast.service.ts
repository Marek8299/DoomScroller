import { Injectable, signal } from '@angular/core';

/** A one-line, self-dismissing notice ("Link copied to clipboard"). Shown by <app-toast> in the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, durationMs = 2500): void {
    clearTimeout(this.timer); // a newer notice replaces the old one and gets its own full duration
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
