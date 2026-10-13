import { Routes } from '@angular/router';
import { AuthPage } from './auth/auth';
import { authGuard } from './core/auth.guard';
import { Feed } from './feed/feed';
import { Upload } from './upload/upload';

export const routes: Routes = [
  { path: '', component: Feed },
  { path: 'u/:username', component: Feed },
  { path: 'upload', component: Upload, canActivate: [authGuard] },
  { path: 'login', component: AuthPage, data: { mode: 'login' } },
  { path: 'register', component: AuthPage, data: { mode: 'register' } },
  { path: '**', redirectTo: '' }
];
