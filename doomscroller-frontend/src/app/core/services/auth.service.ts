import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  /** The signed-in user, or null. Kept in memory only: the real session is an HttpOnly cookie. */
  readonly user = signal<CurrentUser | null>(null);
  readonly isLoggedIn = computed(() => this.user() !== null);

  /** Asks the server who we are (the cookie decides). Run once at startup, before routing. */
  loadCurrentUser(): Observable<CurrentUser | null> {
    return this.http.get<CurrentUser>(`${this.base}/me`).pipe(
      catchError(() => of(null)),
      tap((user) => this.user.set(user))
    );
  }

  login(username: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.base}/login`, { username, password })
      .pipe(tap((user) => this.user.set(user)));
  }

  register(username: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.base}/register`, { username, password })
      .pipe(tap((user) => this.user.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {}).pipe(tap(() => this.user.set(null)));
  }
}
