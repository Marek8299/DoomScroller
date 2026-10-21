import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FollowState, LikedItem, ProfileComment, ProfileEdit, UserProfile } from '../models/video.model';

/** Everything about people: their public profile, following them, and editing your own. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  private path(username: string): string {
    return `${this.base}/users/${encodeURIComponent(username)}`;
  }

  getProfile(username: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.path(username));
  }

  /** Comments they've posted, newest first. */
  getComments(username: string, skip = 0, take = 20): Observable<ProfileComment[]> {
    return this.http.get<ProfileComment[]>(`${this.path(username)}/comments`, { params: { skip, take } });
  }

  /** What they've liked (videos and comments), newest like first. 403 if they keep it private. */
  getLikes(username: string, skip = 0, take = 20): Observable<LikedItem[]> {
    return this.http.get<LikedItem[]>(`${this.path(username)}/likes`, { params: { skip, take } });
  }

  /** Idempotent. */
  follow(username: string): Observable<FollowState> {
    return this.http.put<FollowState>(`${this.path(username)}/follow`, null);
  }

  unfollow(username: string): Observable<FollowState> {
    return this.http.delete<FollowState>(`${this.path(username)}/follow`);
  }

  // --- your own profile ---

  /** A blank bio clears it. `likesPublic` is left alone when omitted. */
  updateProfile(bio: string, likesPublic?: boolean): Observable<ProfileEdit> {
    return this.http.patch<ProfileEdit>(`${this.base}/me/profile`, { bio, likesPublic });
  }

  uploadAvatar(file: File): Observable<ProfileEdit> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.put<ProfileEdit>(`${this.base}/me/avatar`, form);
  }

  removeAvatar(): Observable<ProfileEdit> {
    return this.http.delete<ProfileEdit>(`${this.base}/me/avatar`);
  }
}
