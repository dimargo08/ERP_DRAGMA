import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Api } from './api';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'sales' | 'purchase' | 'accounting';
}

const TOKEN_KEY = 'dragma_token';
const USER_KEY = 'dragma_user';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private api = inject(Api);

  private readonly _user = signal<SessionUser | null>(AuthStore.restore());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());

  static token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string): Observable<SessionUser> {
    return this.api.post<{ token: string; user: SessionUser }>('/auth/login', { email, password }).pipe(
      map((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._user.set(res.user);
        return res.user;
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  private static restore(): SessionUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw && AuthStore.token() ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}

