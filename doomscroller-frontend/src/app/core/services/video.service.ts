import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConversionOptions, UploadFormOptions, VideoItem } from '../models/video.model';

export interface UploadProgress {
  progressPercent: number;
  done: boolean;
  video?: VideoItem;
}

@Injectable({ providedIn: 'root' })
export class VideoService {
  private readonly base = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getUploadFormOptions(): Observable<UploadFormOptions> {
    return this.http.get<UploadFormOptions>(`${this.base}/config/options`);
  }

  getFeed(skip = 0, take = 10): Observable<VideoItem[]> {
    return this.http.get<VideoItem[]>(`${this.base}/videos`, { params: { skip, take } });
  }

  getById(id: string): Observable<VideoItem> {
    return this.http.get<VideoItem>(`${this.base}/videos/${id}`);
  }

  /** Uploads with progress events so the UI can show a real progress bar for large files. */
  upload(file: File, title: string, options: ConversionOptions): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('title', title);
    formData.append('preset', options.preset);
    formData.append('container', options.container);
    formData.append('forceCopyAudioIfSupported', String(options.forceCopyAudioIfSupported));
    formData.append('resolutionTargets', options.resolutionTargets);

    const req = new HttpRequest('POST', `${this.base}/videos`, formData, { reportProgress: true });

    return new Observable<UploadProgress>((subscriber) => {
      this.http.request(req).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            subscriber.next({ progressPercent: Math.round((100 * event.loaded) / event.total), done: false });
          } else if (event.type === HttpEventType.Response) {
            subscriber.next({ progressPercent: 100, done: true, video: event.body as VideoItem });
            subscriber.complete();
          }
        },
        error: (err) => subscriber.error(err)
      });
    });
  }

  mediaUrl(relativeUrl: string): string {
    return `${environment.mediaBaseUrl}${relativeUrl}`;
  }
}
