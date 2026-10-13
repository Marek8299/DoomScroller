import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile, VideoItem } from '../models/video.model';

export interface UploadProgress {
  progressPercent: number;
  done: boolean;
  video?: VideoItem;
}

@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getFeed(skip = 0, take = 10): Observable<VideoItem[]> {
    return this.http.get<VideoItem[]>(`${this.base}/videos`, { params: { skip, take } });
  }

  getProfile(username: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.base}/users/${encodeURIComponent(username)}`);
  }

  /** One author's videos. Their own unfinished uploads are included when it's the signed-in author asking. */
  getUserVideos(username: string, skip = 0, take = 10): Observable<VideoItem[]> {
    return this.http.get<VideoItem[]>(`${this.base}/users/${encodeURIComponent(username)}/videos`, {
      params: { skip, take }
    });
  }

  getById(id: string): Observable<VideoItem> {
    return this.http.get<VideoItem>(`${this.base}/videos/${id}`);
  }

  /** Uploads with progress events so the UI can show a real progress bar for large files. */
  upload(file: File, title: string, description: string, normalizeVolume: boolean): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('normalizeVolume', String(normalizeVolume));

    const req = new HttpRequest('POST', `${this.base}/videos`, formData, { reportProgress: true });

    return this.http.request<VideoItem>(req).pipe(
      filter((e) => e.type === HttpEventType.UploadProgress || e.type === HttpEventType.Response),
      map((e): UploadProgress =>
        e.type === HttpEventType.Response
          ? { progressPercent: 100, done: true, video: e.body as VideoItem }
          : { progressPercent: e.total ? Math.round((100 * e.loaded) / e.total) : 0, done: false }
      )
    );
  }

  mediaUrl(relativeUrl: string): string {
    return `${environment.mediaBaseUrl}${relativeUrl}`;
  }
}
