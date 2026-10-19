import { Routes } from '@angular/router';
import { AuthPage } from './auth/auth';
import { authGuard } from './core/auth.guard';
import { feedUrlMatcher } from './feed-url-matcher';
import { Feed } from './feed/feed';
import { Upload } from './upload/upload';

export const routes: Routes = [
  // "/" is the feed; "/v/:id" is the same feed opened on one particular video (a shared link).
  { matcher: feedUrlMatcher, component: Feed },
  { path: 'u/:username', component: Feed },
  { path: 'upload', component: Upload, canActivate: [authGuard] },
  { path: 'login', component: AuthPage, data: { mode: 'login' } },
  { path: 'register', component: AuthPage, data: { mode: 'register' } },
  { path: '**', redirectTo: '' }
];
