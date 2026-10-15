import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CommentItem } from '../models/video.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Newest first. */
  getComments(videoId: string, skip = 0, take = 20): Observable<CommentItem[]> {
    return this.http.get<CommentItem[]>(`${this.base}/videos/${videoId}/comments`, { params: { skip, take } });
  }

  post(videoId: string, text: string): Observable<CommentItem> {
    return this.http.post<CommentItem>(`${this.base}/videos/${videoId}/comments`, { text });
  }

  delete(videoId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/videos/${videoId}/comments/${commentId}`);
  }
}
