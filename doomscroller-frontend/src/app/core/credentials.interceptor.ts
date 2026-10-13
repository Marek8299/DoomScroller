import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * Sends the auth cookie with every call to our own API. Needed in dev, where the Angular server
 * (localhost:4200) and the API (localhost:5080) are different origins; browsers only attach cookies
 * to cross-origin requests when asked to. Other hosts never get credentials.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith(environment.apiBaseUrl) ? next(req.clone({ withCredentials: true })) : next(req);
