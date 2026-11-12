import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from './runtime-config';

const configuredUrl = RUNTIME_CONFIG.apiUrl?.trim();

export const API_URL =
  configuredUrl && configuredUrl !== '/api'
    ? configuredUrl
    : isDevMode()
      ? 'http://localhost:4000/api'
      : '/api';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<T>(`${API_URL}${path}`, { params }).pipe(catchError(Api.handleError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_URL}${path}`, body).pipe(catchError(Api.handleError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${API_URL}${path}`, body).pipe(catchError(Api.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_URL}${path}`).pipe(catchError(Api.handleError));
  }

  static handleError(err: HttpErrorResponse): Observable<never> {
    const msg =
      err?.error?.error ||
      (err.status === 0
        ? 'No se pudo conectar con el servidor (¿backend corriendo en el puerto 4000?)'
        : `Error ${err.status}`);
    return throwError(() => new Error(msg));
  }
}
