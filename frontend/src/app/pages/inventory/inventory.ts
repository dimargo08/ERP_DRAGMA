import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';

@Component({
  selector: 'app-inventory',
  imports: [FormsModule],
  template: `
    <div class="toolbar">
      <div>
        <h1>Movimientos de inventario</h1>
        <p class="sub muted">Historial de entradas y salidas generadas por ventas, compras y ajustes manuales</p>
      </div>
      <div class="toolbar-actions">
        <select class="input" [(ngModel)]="productFilter" (ngModelChange)="load()">
          <option [ngValue]="">Todos los productos</option>
          @for (p of products(); track p.id) {
            <option [ngValue]="p.id">{{ p.sku }} · {{ p.name }}</option>
          }
        </select>
      </div>
    </div>

    <div class="card table-card">
      <table class="tbl">
        <thead>
          <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="num">Cantidad</th><th>Referencia</th><th>Usuario</th></tr>
        </thead>
        <tbody>
          @for (m of rows(); track m.id) {
            <tr>
              <td class="muted">{{ m.created_at?.slice(0, 16) }}</td>
              <td><code>{{ m.sku }}</code> {{ m.product_name }}</td>
              <td><span class="badge {{ typeClass(m.type) }}">{{ typeLabel(m.type) }}</span></td>
              <td class="num money {{ m.type === 'out' ? 'neg' : 'pos' }}">
                {{ m.type === 'out' ? '−' : '+' }}{{ m.qty }}
              </td>
              <td class="muted">{{ m.reference || '—' }}</td>
              <td class="muted">{{ m.user_name || 'Sistema' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty-cell">Sin movimientos registrados</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class InventoryPage {
  private api = inject(Api);

  protected readonly rows = signal<any[]>([]);
  protected readonly products = signal<any[]>([]);
  protected productFilter: number | '' = '';

  constructor() {
    this.load();
    this.api.get<any[]>('/products').subscribe({ next: (r) => this.products.set(r) });
  }

  protected load(): void {
    const params: Record<string, string> = {};
    if (this.productFilter !== '') params['product_id'] = String(this.productFilter);
    this.api.get<any[]>('/inventory', params).subscribe({ next: (r) => this.rows.set(r) });
  }

  protected typeLabel(t: string): string {
    const m: Record<string, string> = { in: 'Entrada', out: 'Salida', adjust: 'Ajuste' };
    return m[t] ?? t;
  }

  protected typeClass(t: string): string {
    const m: Record<string, string> = { in: 'green', out: 'red', adjust: 'amber' };
    return m[t] ?? 'gray';
  }
}
