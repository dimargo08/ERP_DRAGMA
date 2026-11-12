import { Routes } from '@angular/router';
import { authGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
    title: 'Iniciar sesión · Dragma ERP',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardPage), title: 'Panel · Dragma ERP' },
      { path: 'partners', loadComponent: () => import('./pages/partners/partners').then((m) => m.PartnersPage), title: 'Contactos · Dragma ERP' },
      { path: 'products', loadComponent: () => import('./pages/products/products').then((m) => m.ProductsPage), title: 'Productos · Dragma ERP' },
      { path: 'sales', loadComponent: () => import('./pages/sales/sales').then((m) => m.SalesPage), title: 'Ventas · Dragma ERP' },
      { path: 'sales/pipeline', loadComponent: () => import('./pages/sales/pipeline').then((m) => m.PipelinePage), title: 'Embudo de ventas · Dragma ERP' },
      { path: 'purchases', loadComponent: () => import('./pages/purchases/purchases').then((m) => m.PurchasesPage), title: 'Compras · Dragma ERP' },
      { path: 'invoices', loadComponent: () => import('./pages/invoices/invoices').then((m) => m.InvoicesPage), title: 'Facturación · Dragma ERP' },
      { path: 'inventory', loadComponent: () => import('./pages/inventory/inventory').then((m) => m.InventoryPage), title: 'Inventario · Dragma ERP' },
      { path: 'users', loadComponent: () => import('./pages/users/users').then((m) => m.UsersPage), title: 'Usuarios · Dragma ERP' },
    ],
  },
  { path: '**', redirectTo: '' },
];
