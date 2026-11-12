import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthStore } from '../core/auth.store';
import { Toast } from '../core/toast';
import { UiIcon } from '../shared/icon';
import { UiLogo } from '../shared/logo';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  color: string;
  adminOnly?: boolean;
}

const MENU: MenuItem[] = [
  { path: '/dashboard', label: 'Panel', icon: 'dashboard', color: '#CE6725' },
  { path: '/partners', label: 'Contactos', icon: 'users', color: '#22C55E' },
  { path: '/products', label: 'Productos', icon: 'box', color: '#292766' },
  { path: '/sales', label: 'Ventas', icon: 'cart', color: '#EF4444' },
  { path: '/purchases', label: 'Compras', icon: 'truck', color: '#7C3AED' },
  { path: '/invoices', label: 'Facturación', icon: 'receipt', color: '#F59E0B' },
  { path: '/inventory', label: 'Inventario', icon: 'archive', color: '#0F766E' },
  { path: '/users', label: 'Usuarios', icon: 'shield', color: '#BE5921', adminOnly: true },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiIcon, UiLogo],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)),
    { initialValue: null }
  );

  protected readonly appsOpen = signal(false);
  protected readonly userOpen = signal(false);
  protected readonly menuOpen = signal(true);

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected get menu(): MenuItem[] {
    return MENU.filter((m) => !m.adminOnly || this.auth.user()?.role === 'admin');
  }

  protected toastList() {
    return this.toast.list();
  }

  protected dismissToast(id: number): void {
    this.toast.remove(id);
  }

  protected pageTitle(): string {
    const u = this.url()?.url ?? this.router.url;
    return MENU.find((m) => u.startsWith(m.path))?.label ?? 'Dragma ERP';
  }

  protected roleLabel(): string {
    const roles: Record<string, string> = {
      admin: 'Administrador',
      sales: 'Ventas',
      purchase: 'Compras',
      accounting: 'Contabilidad',
    };
    return roles[this.auth.user()?.role ?? ''] ?? '';
  }

  protected initials(): string {
    return (this.auth.user()?.name ?? '')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected go(path: string): void {
    this.appsOpen.set(false);
    this.userOpen.set(false);
    this.router.navigate([path]);
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
