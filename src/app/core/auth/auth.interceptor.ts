import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

// The bearer token is attached only to requests aimed at our own API, so a
// third party URL fetched by the app can never receive the user's credential.
function isApiRequest(url: string): boolean {
  return url === environment.apiUrl || url.startsWith(`${environment.apiUrl}/`);
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequest(request.url)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();
  const outgoing = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        token &&
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized
      ) {
        auth.logout('expired');
      }
      return throwError(() => error);
    }),
  );
};
