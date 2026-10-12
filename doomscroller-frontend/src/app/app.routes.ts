import { Routes } from '@angular/router';
import { FeedComponent } from './feed/feed.component';
import { UploadComponent } from './upload/upload.component';

export const routes: Routes = [
  { path: '', component: FeedComponent },
  { path: 'upload', component: UploadComponent },
  { path: '**', redirectTo: '' }
];
