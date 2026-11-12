import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../core/toast';
import { UiIcon } from '../../shared/icon';
import { UiModal } from '../../shared/modal';

@Component({
  selector: 'app-partners',
  imports: [FormsModule, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Contactos</h1>
        <p class="sub muted">{{ rows().length }} contactos</p>
      </div>
      <div class="toolbar-actions">
        <div class="search">
          <ui-icon name="search" [size]="16" />
          <input placeholder="Buscar nombre, email o NIF..." [(ngModel)]="term" (ngModelChange)="load()" />
        </div>
        <select class="input" [(ngModel)]="typeFilter" (ngModelChange)="load()">
          <option value="">Todos los tipos</option>
          <option value="customer">Clientes</option>
          <option value="supplier">Proveedores</option>
        </select>
        <button type="button" class="btn btn-primary" (click)="openForm(null)">
          <ui-icon name="plus" [size]="16" /> Nuevo contacto
        </button>
      </div>
    </div>

    <div class="card table-card">
      <table class="tbl">
        <thead>
          <tr>
            <th>Nombre</th><th>Tipo</th><th>Email</th><th>Teléfono</th>
            <th>Ciudad</th><th class="num">Pedidos</th><th style="width:90px"></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td>
                <b>{{ r.name }}</b>
                @if (!r.active) { <span class="badge gray">Inactivo</span> }
              </td>
              <td><span class="badge" [class]="badgeClass(r.type)">{{ typeLabel(r.type) }}</span></td>
              <td class="muted">{{ r.email || '—' }}</td>
              <td class="muted">{{ r.phone || '—' }}</td>
              <td class="muted">{{ r.city || '—' }}</td>
              <td class="num">{{ (r.sales_count || 0) + (r.purchases_count || 0) }}</td>
              <td class="row-actions">
                <button type="button" class="icon-btn" title="Editar" (click)="openForm(r)"><ui-icon name="edit" /></button>
                <button type="button" class="icon-btn danger" title="Desactivar" (click)="remove(r)"><ui-icon name="trash" /></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="empty-cell">No hay contactos que coincidan</td></tr>
          }
        </tbody>
      </table>
    </div>

    <ui-modal [open]="formOpen()" [title]="editingId() ? 'Editar contacto' : 'Nuevo contacto'" (closed)="formOpen.set(false)">
      <div class="form-grid">
        <label class="field span2"><span>Nombre *</span><input name="pname" [(ngModel)]="draft.name" placeholder="Nombre o razón social" /></label>
        <label class="field"><span>Tipo</span>
          <select name="ptype" [(ngModel)]="draft.type">
            <option value="customer">Cliente</option>
            <option value="supplier">Proveedor</option>
            <option value="both">Cliente y proveedor</option>
          </select>
        </label>
        <label class="field"><span>NIF / CIF</span><input name="pvat" [(ngModel)]="draft.vat" /></label>
        <label class="field"><span>Email</span><input name="pemail" type="email" [(ngModel)]="draft.email" /></label>
        <label class="field"><span>Teléfono</span><input name="pphone" [(ngModel)]="draft.phone" /></label>
        <label class="field span2"><span>Dirección</span><input name="paddr" [(ngModel)]="draft.address" /></label>
        <label class="field"><span>Ciudad</span><input name="pcity" [(ngModel)]="draft.city" /></label>
        <label class="field"><span>País</span><input name="pcountry" [(ngModel)]="draft.country" /></label>
        <label class="check"><input type="checkbox" name="pactive" [(ngModel)]="draft.active" /> Activo</label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()">Guardar</button>
      </div>
    </ui-modal>
  `,
})
export class PartnersPage {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly rows = signal<any[]>([]);
  protected term = '';
  protected typeFilter = '';
  protected readonly formOpen = signal(false);
  protected editingId = signal<number | null>(null);
  protected draft: any = {};

  constructor() {
    this.load();
  }

  protected load(): void {
    const params: Record<string, string> = {};
    if (this.term.trim()) params['q'] = this.term.trim();
    if (this.typeFilter) params['type'] = this.typeFilter;
    this.api.get<any[]>('/partners', params).subscribe({ next: (r) => this.rows.set(r) });
  }

  protected openForm(p: any): void {
    this.editingId.set(p ? p.id : null);
    this.draft = p
      ? { ...p, active: !!p.active }
      : { name: '', type: 'customer', email: '', phone: '', vat: '', address: '', city: '', country: '', active: true };
    this.formOpen.set(true);
  }

  protected save(): void {
    if (!this.draft.name?.trim()) {
      this.toast.error('El nombre es obligatorio');
      return;
    }
    const body = { ...this.draft };
    const obs = this.editingId()
      ? this.api.put(`/partners/${this.editingId()}`, body)
      : this.api.post('/partners', body);
    obs.subscribe({
      next: () => {
        this.toast.ok(this.editingId() ? 'Contacto actualizado' : 'Contacto creado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected remove(r: any): void {
    if (!confirm(`¿Desactivar el contacto "${r.name}"?`)) return;
    this.api.delete(`/partners/${r.id}`).subscribe({
      next: () => {
        this.toast.ok('Contacto desactivado');
        this.load();
      },
    });
  }

  protected typeLabel(t: string): string {
    return t === 'customer' ? 'Cliente' : t === 'supplier' ? 'Proveedor' : 'Ambos';
  }

  protected badgeClass(t: string): string {
    return t === 'customer' ? 'green' : t === 'supplier' ? 'purple' : 'blue';
  }
}
