import { Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

/** One page for both /login and /register; the route's `data.mode` picks which. */
@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.scss'
})
export class AuthPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Both bound from the router (withComponentInputBinding): route data and ?returnUrl=...
  readonly mode = input<'login' | 'register'>('login');
  readonly returnUrl = input<string>();

  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);

  // Mirrors CredentialRules on the backend (the server is the authority; this is just early feedback).
  protected readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]]
  });

  protected submit(): void {
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set(undefined);

    const { username, password } = this.form.getRawValue();
    const request = this.isRegister() ? this.auth.register(username, password) : this.auth.login(username, password);

    request.subscribe({
      next: () => this.router.navigateByUrl(this.safeReturnUrl()),
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(
          err?.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : typeof err?.error === 'string' && err.error
              ? err.error
              : 'Something went wrong. Please try again.'
        );
      }
    });
  }

  /** Only follow in-app paths; "//evil.com" or "https://..." would turn login into an open redirect. */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
