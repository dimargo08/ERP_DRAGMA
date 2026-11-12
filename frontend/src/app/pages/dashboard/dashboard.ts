import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { UiIcon } from '../../shared/icon';

interface Stats {
  counters: {
    customers: number;
    suppliers: number;
    products: number;
    open_orders: number;
    pending_invoices: number;
    total_collected: number;
  };
  salesByMonth: { month: string; total: number }[];
  topProducts: { description: string; qty: number; total: number }[];
  lowStock: { id: number; name: string; sku: string; qty_available: number; min_stock: number }[];
  recentOrders: { id: number; name: string; state: string; amount_total: number; date_order: string; partner_name: string }[];
  monthRevenue: number;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, RouterLink, UiIcon],
  templateUrl: './dashboard.html',
})
export class DashboardPage {
  private api = inject(Api);
  protected readonly stats = signal<Stats | null>(null);

  protected readonly kpis = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Ingresos del mes', value: s.monthRevenue, money: true, color: '#CE6725', icon: 'dashboard' },
      { label: 'Cobrado total', value: s.counters.total_collected, money: true, color: '#22C55E', icon: 'receipt' },
      { label: 'Pedidos abiertos', value: s.counters.open_orders, money: false, color: '#EF4444', icon: 'cart' },
      { label: 'Facturas pendientes', value: s.counters.pending_invoices, money: false, color: '#F59E0B', icon: 'warning' },
      { label: 'Clientes', value: s.counters.customers, money: false, color: '#292766', icon: 'users' },
      { label: 'Proveedores', value: s.counters.suppliers, money: false, color: '#7C3AED', icon: 'truck' },
    ];
  });

  protected readonly maxMonth = computed(() =>
    Math.max(1, ...(this.stats()?.salesByMonth ?? []).map((m) => Number(m.total)))
  );

  protected readonly maxTop = computed(() =>
    Math.max(1, ...(this.stats()?.topProducts ?? []).map((p) => Number(p.total)))
  );

  protected readonly salesStateLabels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviado',
    sale: 'Pedido',
    done: 'Hecho',
    cancel: 'Cancelado',
  };

  constructor() {
    this.api.get<Stats>('/dashboard/stats').subscribe({ next: (s) => this.stats.set(s) });
  }

  track(): void {}

  fmtMonth(m: string): string {
    const [y, mo] = m.split('-');
    return `${MONTHS[Number(mo) - 1]} ${y.slice(2)}`;
  }

  fmtMoney(v: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0);
  }
}
