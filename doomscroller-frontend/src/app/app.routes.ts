import { Routes } from '@angular/router';
import { Feed } from './feed/feed';
import { Upload } from './upload/upload';

export const routes: Routes = [
  { path: '', component: Feed },
  { path: 'upload', component: Upload },
  { path: '**', redirectTo: '' }
];
