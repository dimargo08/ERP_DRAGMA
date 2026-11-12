import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Toast } from '../../core/toast';
import { UiIcon } from '../../shared/icon';
import { UiModal } from '../../shared/modal';

interface DocLine {
  product_id: number | null;
  description: string;
  qty: number;
  price_unit: number;
}

const STATES = ['', 'draft', 'sent', 'sale', 'done', 'cancel'];

@Component({
  selector: 'app-sales',
  imports: [FormsModule, DecimalPipe, RouterLink, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Pedidos de venta</h1>
        <p class="sub muted">{{ rows().length }} pedidos</p>
      </div>
      <div class="toolbar-actions">
        <div class="search">
          <ui-icon name="search" [size]="16" />
          <input placeholder="Buscar pedido o cliente..." [(ngModel)]="term" (ngModelChange)="load()" />
        </div>
        <button type="button" class="btn btn-primary" (click)="openForm()">
          <ui-icon name="plus" [size]="16" /> Nuevo pedido
        </button>
      </div>
    </div>

    <div class="view-tabs">
      <a routerLink="/sales" class="view-tab active"><ui-icon name="receipt" [size]="15" /> Pedidos</a>
      <a routerLink="/sales/pipeline" class="view-tab"><ui-icon name="dashboard" [size]="15" /> Embudo</a>
    </div>

    <div class="chips">
      @for (s of stateChips; track s.value) {
        <button type="button" class="chip" [class.active]="stateFilter === s.value" (click)="stateFilter = s.value; load()">
          {{ s.label }}
        </button>
      }
    </div>

    <div class="card table-card">
      <table class="tbl">
        <thead>
          <tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th class="num">Total</th><th style="width:60px"></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr (click)="openForm(r.id)" class="row-link">
              <td><b>{{ r.name }}</b></td>
              <td>{{ r.partner_name }}</td>
              <td class="muted">{{ r.date_order?.slice(0, 10) }}</td>
              <td><span class="badge {{ stateClass(r.state) }}">{{ stateLabel(r.state) }}</span></td>
              <td class="num money">{{ r.amount_total | number: '1.2-2' }} €</td>
              <td class="row-actions"><ui-icon name="chevronDown" [size]="16" /></td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty-cell">No hay pedidos</td></tr>
          }
        </tbody>
      </table>
    </div>

    <ui-modal [open]="formOpen()" [large]="true" [title]="docTitle()" (closed)="formOpen.set(false)">
      @if (!editingId()) {
        <div class="form-grid">
          <label class="field span2"><span>Cliente *</span>
            <select name="spartner" [(ngModel)]="header.partner_id">
              <option [ngValue]="null">Selecciona un cliente...</option>
              @for (p of partners(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }}</option>
              }
            </select>
          </label>
          <label class="field span2"><span>Notas internas</span>
            <textarea name="snotes" rows="2" [(ngModel)]="header.notes" placeholder="Condiciones, observaciones..."></textarea>
          </label>
        </div>
      }

      <h4 class="sec-title">Líneas del pedido</h4>
      <table class="tbl lines-tbl">
        <thead>
          <tr><th style="width:36%">Producto</th><th>Cant.</th><th>Precio €</th><th class="num">Importe</th><th style="width:44px"></th></tr>
        </thead>
        <tbody>
          @for (l of lines; track $index) {
            <tr>
              <td>
                <select class="input" [(ngModel)]="l.product_id" (ngModelChange)="onProduct(l)" [disabled]="!editable">
                  <option [ngValue]="null">— Personalizado —</option>
                  @for (p of products(); track p.id) {
                    <option [ngValue]="p.id">{{ p.sku }} · {{ p.name }}</option>
                  }
                </select>
                @if (l.product_id === null) {
                  <input class="input mt4" placeholder="Descripción libre..." [(ngModel)]="l.description" [disabled]="!editable" />
                }
              </td>
              <td><input class="input num-in" type="number" min="0.01" step="any" [(ngModel)]="l.qty" [disabled]="!editable" /></td>
              <td><input class="input num-in" type="number" min="0" step="any" [(ngModel)]="l.price_unit" [disabled]="!editable" /></td>
              <td class="num money">{{ l.qty * l.price_unit | number: '1.2-2' }} €</td>
              <td>
                @if (editable) {
                  <button type="button" class="icon-btn danger" title="Quitar línea" (click)="lines.splice($index, 1)">
                    <ui-icon name="trash" />
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (editable) {
        <button type="button" class="btn btn-ghost btn-sm mt8" (click)="addLine()">
          <ui-icon name="plus" [size]="14" /> Añadir línea
        </button>
      }
      <div class="totals-row">
        <span>Base imponible</span>
        <b>{{ subtotal() | number: '1.2-2' }} €</b>
      </div>

      <div class="modal-foot split">
        <div>
          @if (editingId() && currentState === 'draft') {
            <button type="button" class="btn btn-danger btn-sm" (click)="del()"><ui-icon name="trash" [size]="14" /> Eliminar</button>
          }
        </div>
        <div class="foot-actions">
          @if (editable) {
            <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="save()">Guardar pedido</button>
          }
          @switch (currentState) {
            @case ('draft') {
              <button type="button" class="btn btn-outline" (click)="act('send')">Enviar al cliente</button>
              <button type="button" class="btn btn-primary" (click)="act('confirm')">Confirmar venta</button>
            }
            @case ('sent') {
              <button type="button" class="btn btn-primary" (click)="act('confirm')">Confirmar venta</button>
              <button type="button" class="btn btn-ghost" (click)="act('cancel')">Cancelar</button>
            }
            @case ('sale') {
              <button type="button" class="btn btn-primary" (click)="act('done')">Finalizar entrega</button>
              <button type="button" class="btn btn-ghost" (click)="act('cancel')">Cancelar</button>
            }
          }
        </div>
      </div>
    </ui-modal>
  `,
})
export class SalesPage {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly rows = signal<any[]>([]);
  protected readonly partners = signal<any[]>([]);
  protected readonly products = signal<any[]>([]);

  protected term = '';
  protected stateFilter = '';
  protected readonly stateChips = [
    { value: '', label: 'Todos' },
    { value: 'draft', label: 'Borrador' },
    { value: 'sent', label: 'Enviado' },
    { value: 'sale', label: 'Pedido' },
    { value: 'done', label: 'Hecho' },
    { value: 'cancel', label: 'Cancelado' },
  ];

  protected readonly formOpen = signal(false);
  protected editingId = signal<number | null>(null);
  protected header: { partner_id: number | null; notes: string } = { partner_id: null, notes: '' };
  protected lines: DocLine[] = [];
  protected currentState: string | null = null;

  constructor() {
    this.load();
    this.api.get<any[]>('/partners?type=customer').subscribe({ next: (r) => this.partners.set(r) });
    this.api.get<any[]>('/products').subscribe({ next: (r) => this.products.set(r) });
  }

  protected load(): void {
    const params: Record<string, string> = {};
    if (this.term.trim()) params['q'] = this.term.trim();
    if (this.stateFilter) params['state'] = this.stateFilter;
    this.api.get<any[]>('/sales/orders', params).subscribe({ next: (r) => this.rows.set(r) });
  }

  protected openForm(id?: number): void {
    if (!id) {
      this.editingId.set(null);
      this.currentState = null;
      this.header = { partner_id: null, notes: '' };
      this.lines = [{ product_id: null, description: '', qty: 1, price_unit: 0 }];
      this.formOpen.set(true);
      return;
    }
    this.api.get<any>(`/sales/orders/${id}`).subscribe({
      next: (d) => {
        this.editingId.set(d.id);
        this.currentState = d.state;
        this.header = { partner_id: d.partner_id, notes: d.notes || '' };
        this.lines = (d.lines || []).map((l: any) => ({
          product_id: l.product_id,
          description: l.description,
          qty: Number(l.qty),
          price_unit: Number(l.price_unit),
        }));
        this.formOpen.set(true);
      },
    });
  }

  protected get editable(): boolean {
    if (!this.editingId()) return true;
    return ['draft', 'sent'].includes(this.currentState ?? '');
  }

  protected docTitle(): string {
    const row = this.rows().find((r) => r.id === this.editingId());
    return row ? `Pedido ${row.name}` : 'Nuevo pedido de venta';
  }

  protected onProduct(l: DocLine): void {
    const p = this.products().find((x) => x.id === l.product_id);
    if (p) {
      l.description = p.name;
      l.price_unit = Number(p.price);
    }
  }

  protected addLine(): void {
    this.lines.push({ product_id: null, description: '', qty: 1, price_unit: 0 });
  }

  protected subtotal(): number {
    return Math.round(this.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price_unit) || 0), 0) * 100) / 100;
  }

  protected save(): void {
    if (!this.header.partner_id) return this.toast.error('Selecciona un cliente');
    const validLines = this.lines.filter((l) => l.description?.trim() && Number(l.qty) > 0);
    if (!validLines.length) return this.toast.error('Añade al menos una línea con descripción y cantidad');
    const body = { ...this.header, lines: validLines };
    const obs = this.editingId()
      ? this.api.put(`/sales/orders/${this.editingId()}`, body)
      : this.api.post('/sales/orders', body);
    obs.subscribe({
      next: () => {
        this.toast.ok('Pedido guardado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected act(action: string): void {
    if (!confirm(`¿Aplicar la acción "${action}" a este pedido?`)) return;
    this.api
      .post(`/sales/orders/${this.editingId()}/action`, { action })
      .subscribe({
        next: () => {
          this.toast.ok('Estado actualizado');
          this.formOpen.set(false);
          this.load();
        },
        error: (e: Error) => this.toast.error(e.message),
      });
  }

  protected del(): void {
    if (!confirm('¿Eliminar definitivamente este pedido?')) return;
    this.api.delete(`/sales/orders/${this.editingId()}`).subscribe({
      next: () => {
        this.toast.ok('Pedido eliminado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected stateLabel(s: string): string {
    const m: Record<string, string> = { draft: 'Borrador', sent: 'Enviado', sale: 'Pedido', done: 'Hecho', cancel: 'Cancelado' };
    return m[s] ?? s;
  }

  protected stateClass(s: string): string {
    const m: Record<string, string> = { draft: 'gray', sent: 'blue', sale: 'green', done: 'teal', cancel: 'red' };
    return m[s] ?? 'gray';
  }
}
