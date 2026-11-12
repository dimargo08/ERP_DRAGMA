import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../core/toast';
import { UiIcon } from '../../shared/icon';
import { UiModal } from '../../shared/modal';

@Component({
  selector: 'app-products',
  imports: [FormsModule, DecimalPipe, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Productos</h1>
        <p class="sub muted">{{ rows().length }} productos</p>
      </div>
      <div class="toolbar-actions">
        <div class="search">
          <ui-icon name="search" [size]="16" />
          <input placeholder="Buscar nombre o referencia..." [(ngModel)]="term" (ngModelChange)="load()" />
        </div>
        <button type="button" class="btn btn-primary" (click)="openForm(null)">
          <ui-icon name="plus" [size]="16" /> Nuevo producto
        </button>
      </div>
    </div>

    <div class="card table-card">
      <table class="tbl">
        <thead>
          <tr>
            <th>Referencia</th><th>Producto</th><th>Categoría</th>
            <th class="num">Precio venta</th><th class="num">Coste</th>
            <th class="num">Stock</th><th style="width:120px"></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td><code>{{ r.sku }}</code></td>
              <td>
                <b>{{ r.name }}</b>
                @if (r.type === 'service') { <span class="badge purple">Servicio</span> }
                @if (!r.active) { <span class="badge gray">Inactivo</span> }
              </td>
              <td class="muted">{{ r.category_name || '—' }}</td>
              <td class="num money">{{ r.price | number: '1.2-2' }} €</td>
              <td class="num muted">{{ r.cost | number: '1.2-2' }} €</td>
              <td class="num">
                @if (r.type === 'service') {
                  <span class="muted">—</span>
                } @else if (+r.qty_available <= +r.min_stock) {
                  <span class="badge red">{{ r.qty_available }} ⚠</span>
                } @else {
                  {{ r.qty_available }}
                }
              </td>
              <td class="row-actions">
                @if (r.type !== 'service') {
                  <button type="button" class="icon-btn" title="Ajustar stock" (click)="openStock(r)">±</button>
                }
                <button type="button" class="icon-btn" title="Editar" (click)="openForm(r)"><ui-icon name="edit" /></button>
                <button type="button" class="icon-btn danger" title="Desactivar" (click)="remove(r)"><ui-icon name="trash" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty-cell">No hay productos que coincidan</td></tr>
          }
        </tbody>
      </table>
    </div>

    <ui-modal [open]="formOpen()" [title]="editingId() ? 'Editar producto' : 'Nuevo producto'" (closed)="formOpen.set(false)">
      <div class="form-grid">
        <label class="field span2"><span>Nombre *</span><input name="nname" [(ngModel)]="draft.name" /></label>
        <label class="field"><span>Referencia (SKU) *</span><input name="nsku" [(ngModel)]="draft.sku" /></label>
        <label class="field"><span>Categoría</span>
          <select name="ncat" [(ngModel)]="draft.category_id" (ngModelChange)="onCategory($event)">
            <option [ngValue]="null">Sin categoría</option>
            @for (c of categories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
            <option value="__new">+ Nueva categoría...</option>
          </select>
        </label>
        <label class="field"><span>Tipo</span>
          <select name="ntype" [(ngModel)]="draft.type">
            <option value="product">Producto (almacenable)</option>
            <option value="service">Servicio</option>
          </select>
        </label>
        <label class="field"><span>Precio venta (€)</span><input name="nprice" type="number" min="0" step="any" [(ngModel)]="draft.price" /></label>
        <label class="field"><span>Coste (€)</span><input name="ncost" type="number" min="0" step="any" [(ngModel)]="draft.cost" /></label>
        @if (!editingId() && draft.type === 'product') {
          <label class="field"><span>Cantidad inicial</span><input name="nqty" type="number" min="0" step="any" [(ngModel)]="draft.qty_available" /></label>
        }
        <label class="field"><span>Stock mínimo</span><input name="nmin" type="number" min="0" step="any" [(ngModel)]="draft.min_stock" /></label>
        <label class="field"><span>Unidad de medida</span><input name="nuom" [(ngModel)]="draft.uom" placeholder="Unidades, kg, h..." /></label>
        <label class="check"><input type="checkbox" name="nactive" [(ngModel)]="draft.active" /> Activo</label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()">Guardar</button>
      </div>
    </ui-modal>

    <ui-modal [open]="stockOpen()" [title]="'Ajuste de stock · ' + (stockProduct()?.name ?? '')" (closed)="stockOpen.set(false)">
      <p class="muted small">Stock actual: <b>{{ stockProduct()?.qty_available }}</b></p>
      <div class="form-grid">
        <label class="field"><span>Tipo de movimiento</span>
          <select name="stype" [(ngModel)]="stockDraft.type">
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
            <option value="adjust">Fijar recuento exacto</option>
          </select>
        </label>
        <label class="field"><span>Cantidad</span><input name="sqty" type="number" min="0.01" step="any" [(ngModel)]="stockDraft.qty" /></label>
        <label class="field span2"><span>Referencia / motivo</span><input name="sref" [(ngModel)]="stockDraft.reference" placeholder="Ej: Recuento anual" /></label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" (click)="stockOpen.set(false)">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="saveStock()">Aplicar movimiento</button>
      </div>
    </ui-modal>
  `,
})
export class ProductsPage {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly rows = signal<any[]>([]);
  protected readonly categories = signal<any[]>([]);
  protected term = '';
  protected readonly formOpen = signal(false);
  protected editingId = signal<number | null>(null);
  protected draft: any = {};

  protected readonly stockOpen = signal(false);
  protected readonly stockProduct = signal<any>(null);
  protected stockDraft: any = {};

  constructor() {
    this.load();
    this.loadCategories();
  }

  protected load(): void {
    const params: Record<string, string> = {};
    if (this.term.trim()) params['q'] = this.term.trim();
    this.api.get<any[]>('/products', params).subscribe({ next: (r) => this.rows.set(r) });
  }

  private loadCategories(): void {
    this.api.get<any[]>('/products/categories').subscribe({ next: (c) => this.categories.set(c) });
  }

  protected onCategory(v: any): void {
    if (v === '__new') {
      const name = prompt('Nombre de la nueva categoría:');
      if (name && name.trim()) {
        this.api.post<any>('/products/categories', { name: name.trim() }).subscribe({
          next: (c) => {
            this.toast.ok('Categoría creada');
            this.loadCategories();
            setTimeout(() => (this.draft.category_id = c.id));
          },
        });
      }
      this.draft.category_id = null;
    }
  }

  protected openForm(p: any): void {
    this.editingId.set(p ? p.id : null);
    this.draft = p
      ? { ...p, active: !!p.active }
      : { name: '', sku: '', category_id: null, type: 'product', price: 0, cost: 0, qty_available: 0, min_stock: 0, uom: 'Unidad', active: true };
    this.formOpen.set(true);
  }

  protected save(): void {
    if (!this.draft.name?.trim() || !this.draft.sku?.trim()) {
      this.toast.error('Nombre y referencia son obligatorios');
      return;
    }
    const body = {
      ...this.draft,
      price: Number(this.draft.price) || 0,
      cost: Number(this.draft.cost) || 0,
      min_stock: Number(this.draft.min_stock) || 0,
      qty_available: Number(this.draft.qty_available) || 0,
    };
    const obs = this.editingId()
      ? this.api.put(`/products/${this.editingId()}`, body)
      : this.api.post('/products', body);
    obs.subscribe({
      next: () => {
        this.toast.ok(this.editingId() ? 'Producto actualizado' : 'Producto creado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected remove(r: any): void {
    if (!confirm(`¿Desactivar el producto "${r.name}"?`)) return;
    this.api.delete(`/products/${r.id}`).subscribe({
      next: () => {
        this.toast.ok('Producto desactivado');
        this.load();
      },
    });
  }

  protected openStock(p: any): void {
    this.stockProduct.set(p);
    this.stockDraft = { type: 'in', qty: 1, reference: '' };
    this.stockOpen.set(true);
  }

  protected saveStock(): void {
    const qty = Number(this.stockDraft.qty);
    if (!(qty > 0)) {
      this.toast.error('Introduce una cantidad válida');
      return;
    }
    const p = this.stockProduct();
    this.api
      .post(`/products/${p.id}/stock`, { ...this.stockDraft, qty })
      .subscribe({
        next: () => {
          this.toast.ok('Movimiento aplicado');
          this.stockOpen.set(false);
          this.load();
        },
        error: (e: Error) => this.toast.error(e.message),
      });
  }
}
