import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/credentials.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Binds route params / query params / route data to component inputs (see Feed and AuthPage).
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    // Find out who is signed in before the first route renders, so guards and the top bar are right.
    provideAppInitializer(() => inject(AuthService).loadCurrentUser())
  ]
};
