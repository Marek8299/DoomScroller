import { Component, inject } from '@angular/core';
import { ToastService } from './core/services/toast.service';

/**
 * The container is always in the page and only its text changes: screen readers announce changes to
 * an existing live region, but often miss one that appears together with its content.
 */
@Component({
  selector: 'app-toast',
  template: `
    <div class="toast-region" role="status" aria-live="polite">
      @if (toast.message(); as message) {
        <div class="toast">{{ message }}</div>
      }
    </div>
  `,
  styles: `
    .toast-region {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 110px; // above the action buttons and the seek bar
      z-index: 20;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    .toast {
      max-width: 90vw;
      padding: 10px 18px;
      border-radius: 20px;
      background: rgba(30, 30, 30, 0.95);
      border: 1px solid #333;
      color: #fff;
      font-size: 0.9rem;
    }
  `
})
export class Toast {
  protected readonly toast = inject(ToastService);
}
