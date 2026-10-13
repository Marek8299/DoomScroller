import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

/** Sends anonymous visitors to the login page, remembering where they were headed. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isLoggedIn() || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
