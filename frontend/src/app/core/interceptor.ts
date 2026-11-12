import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { Toast } from './toast';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const toast = inject(Toast);
  const router = inject(Router);

  const token = AuthStore.token();
  const isLoginCall = req.url.includes('/auth/login');
  const authReq = token && !isLoginCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!isLoginCall && err.status === 401) {
        auth.logout();
        router.navigate(['/login']);
        toast.error('Tu sesión ha expirado, inicia sesión de nuevo');
      } else if (!isLoginCall && err.status !== 401) {
        const msg = err?.error?.error || (err.status === 0 ? 'Sin conexión con el servidor' : `Error ${err.status}`);
        toast.error(msg);
      }
      return throwError(() => new Error(err?.error?.error || err.message));
    })
  );
};
