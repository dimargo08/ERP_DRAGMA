import { Component, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { DEMO_MODE } from '../../core/runtime-config';
import { UiLogo } from '../../shared/logo';

@Component({
  selector: 'app-login',
  imports: [FormsModule, UiLogo],
  templateUrl: './login.html',
})
export class LoginPage {
  private auth = inject(AuthStore);
  private router = inject(Router);

  protected readonly showDemo = isDevMode() || DEMO_MODE;
  protected email = this.showDemo ? 'admin@dragma.com' : '';
  protected password = this.showDemo ? 'demo123' : '';
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  constructor() {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  submit(ev: Event): void {
    ev.preventDefault();
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e: Error) => {
        this.error.set(e.message || 'No se pudo iniciar sesión');
        this.loading.set(false);
      },
    });
  }
}
