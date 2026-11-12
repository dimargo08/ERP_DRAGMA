import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

@Component({
  selector: 'app-invoices',
  imports: [FormsModule, DecimalPipe, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Facturación</h1>
        <p class="sub muted">{{ rows().length }} facturas</p>
      </div>
      <div class="toolbar-actions">
        <div class="search">
          <ui-icon name="search" [size]="16" />
          <input placeholder="Buscar número o contacto..." [(ngModel)]="term" (ngModelChange)="load()" />
        </div>
        <button type="button" class="btn btn-primary" (click)="openForm()">
          <ui-icon name="plus" [size]="16" /> Nueva factura
        </button>
      </div>
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
          <tr><th>Factura</th><th>Contacto</th><th>Tipo</th><th>Fecha</th><th>Vence</th><th>Estado</th><th class="num">Total</th><th style="width:60px"></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr (click)="openForm(r.id)" class="row-link">
              <td><b>{{ r.number }}</b></td>
              <td>{{ r.partner_name }}</td>
              <td><span class="badge {{ r.type === 'customer' ? 'green' : 'purple' }}">{{ r.type === 'customer' ? 'Emitida' : 'Recibida' }}</span></td>
              <td class="muted">{{ r.invoice_date || '—' }}</td>
              <td class="muted">{{ r.due_date || '—' }}</td>
              <td><span class="badge {{ stateClass(r.state) }}">{{ stateLabel(r.state) }}</span></td>
              <td class="num money">{{ r.amount_total | number: '1.2-2' }} €</td>
              <td class="row-actions"><ui-icon name="chevronDown" [size]="16" /></td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="empty-cell">No hay facturas</td></tr>
          }
        </tbody>
      </table>
    </div>

    <ui-modal [open]="formOpen()" [large]="true" [title]="docTitle()" (closed)="formOpen.set(false)">
      @if (!editingId()) {
        <div class="form-grid">
          <label class="field"><span>Tipo de factura</span>
            <select name="itype" [(ngModel)]="header.type">
              <option value="customer">Cliente (emitida)</option>
              <option value="supplier">Proveedor (recibida)</option>
            </select>
          </label>
          <label class="field"><span>Contacto *</span>
            <select name="ipartner" [(ngModel)]="header.partner_id">
              <option [ngValue]="null">Selecciona...</option>
              @for (p of partnerList(); track p.id) {
                <option [ngValue]="p.id">{{ p.name }}</option>
              }
            </select>
          </label>
          <label class="field"><span>Fecha factura</span><input name="idate" type="date" [(ngModel)]="header.invoice_date" /></label>
          <label class="field"><span>Vencimiento</span><input name="idue" type="date" [(ngModel)]="header.due_date" /></label>
          <label class="field"><span>IVA (%)</span><input name="itax" type="number" min="0" max="100" step="any" [(ngModel)]="header.tax_rate" /></label>
        </div>
      }

      <h4 class="sec-title">Líneas</h4>
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
                  <input class="input mt4" placeholder="Concepto..." [(ngModel)]="l.description" [disabled]="!editable" />
                }
              </td>
              <td><input class="input num-in" type="number" min="0.01" step="any" [(ngModel)]="l.qty" [disabled]="!editable" /></td>
              <td><input class="input num-in" type="number" min="0" step="any" [(ngModel)]="l.price_unit" [disabled]="!editable" /></td>
              <td class="num money">{{ l.qty * l.price_unit | number: '1.2-2' }} €</td>
              <td>
                @if (editable) {
                  <button type="button" class="icon-btn danger" (click)="lines.splice($index, 1)"><ui-icon name="trash" /></button>
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

      <div class="totals-row stack">
        <div><span>Base imponible</span><b>{{ untaxed() | number: '1.2-2' }} €</b></div>
        <div><span>Impuestos ({{ header.tax_rate || 0 }}%)</span><b>{{ taxAmount() | number: '1.2-2' }} €</b></div>
        <div class="grand"><span>Total</span><b>{{ total() | number: '1.2-2' }} €</b></div>
      </div>

      <div class="modal-foot split">
        <div>
          @if (editingId() && ['draft', 'cancel'].includes(currentState ?? '')) {
            <button type="button" class="btn btn-danger btn-sm" (click)="del()"><ui-icon name="trash" [size]="14" /> Eliminar</button>
          }
        </div>
        <div class="foot-actions">
          @if (editable) {
            <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="save()">Guardar borrador</button>
          }
          @switch (currentState) {
            @case ('draft') {
              <button type="button" class="btn btn-primary" (click)="act('post')">Publicar factura</button>
            }
            @case ('posted') {
              <button type="button" class="btn btn-primary" (click)="act('pay')">Registrar pago</button>
              <button type="button" class="btn btn-ghost" (click)="act('cancel')">Anular</button>
            }
          }
        </div>
      </div>
    </ui-modal>
  `,
})
export class InvoicesPage {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly rows = signal<any[]>([]);
  protected readonly products = signal<any[]>([]);
  protected readonly allPartners = signal<any[]>([]);

  protected term = '';
  protected stateFilter = '';
  protected readonly stateChips = [
    { value: '', label: 'Todas' },
    { value: 'draft', label: 'Borrador' },
    { value: 'posted', label: 'Publicadas' },
    { value: 'paid', label: 'Pagadas' },
  ];

  protected readonly formOpen = signal(false);
  protected editingId = signal<number | null>(null);
  protected header: any = {};
  protected lines: DocLine[] = [];
  protected currentState: string | null = null;

  constructor() {
    this.load();
    this.api.get<any[]>('/products').subscribe({ next: (r) => this.products.set(r) });
    this.api.get<any[]>('/partners').subscribe({ next: (r) => this.allPartners.set(r) });
  }

  protected load(): void {
    const params: Record<string, string> = {};
    if (this.term.trim()) params['q'] = this.term.trim();
    if (this.stateFilter) params['state'] = this.stateFilter;
    this.api.get<any[]>('/invoices', params).subscribe({ next: (r) => this.rows.set(r) });
  }

  protected partnerList(): any[] {
    const t = this.header.type;
    return this.allPartners().filter((p) => !t || p.type === t || p.type === 'both');
  }

  protected openForm(id?: number): void {
    if (!id) {
      this.editingId.set(null);
      this.currentState = null;
      this.header = {
        type: 'customer',
        partner_id: null,
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: '',
        tax_rate: 21,
      };
      this.lines = [{ product_id: null, description: '', qty: 1, price_unit: 0 }];
      this.formOpen.set(true);
      return;
    }
    this.api.get<any>(`/invoices/${id}`).subscribe({
      next: (d) => {
        this.editingId.set(d.id);
        this.currentState = d.state;
        this.header = d;
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
    return ['draft', 'cancel'].includes(this.currentState ?? '');
  }

  protected docTitle(): string {
    return this.editingId()
      ? `Factura ${this.rows().find((r) => r.id === this.editingId())?.number ?? ''}`
      : 'Nueva factura';
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

  protected untaxed(): number {
    return Math.round(this.lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price_unit) || 0), 0) * 100) / 100;
  }

  protected taxAmount(): number {
    return Math.round((this.untaxed() * (Number(this.header.tax_rate) || 0)) / 100 * 100) / 100;
  }

  protected total(): number {
    return Math.round((this.untaxed() + this.taxAmount()) * 100) / 100;
  }

  protected save(): void {
    if (!this.header.partner_id) return this.toast.error('Selecciona un contacto');
    const validLines = this.lines.filter((l) => l.description?.trim() && Number(l.qty) > 0);
    if (!validLines.length) return this.toast.error('Añade al menos una línea válida');
    this.api
      .post('/invoices', { ...this.header, tax_rate: Number(this.header.tax_rate) || 0, lines: validLines })
      .subscribe({
        next: () => {
          this.toast.ok('Borrador de factura creado');
          this.formOpen.set(false);
          this.load();
        },
        error: (e: Error) => this.toast.error(e.message),
      });
  }

  protected act(action: string): void {
    if (!confirm(`¿Aplicar "${action}" a esta factura?`)) return;
    this.api.post(`/invoices/${this.editingId()}/action`, { action }).subscribe({
      next: () => {
        this.toast.ok('Estado actualizado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected del(): void {
    if (!confirm('¿Eliminar esta factura?')) return;
    this.api.delete(`/invoices/${this.editingId()}`).subscribe({
      next: () => {
        this.toast.ok('Factura eliminada');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected stateLabel(s: string): string {
    const m: Record<string, string> = { draft: 'Borrador', posted: 'Publicada', paid: 'Pagada', cancel: 'Anulada' };
    return m[s] ?? s;
  }

  protected stateClass(s: string): string {
    const m: Record<string, string> = { draft: 'gray', posted: 'amber', paid: 'green', cancel: 'red' };
    return m[s] ?? 'gray';
  }
}
