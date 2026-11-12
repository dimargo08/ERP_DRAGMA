import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { Toast } from '../../core/toast';
import { UiIcon } from '../../shared/icon';
import { UiModal } from '../../shared/modal';

@Component({
  selector: 'app-users',
  imports: [FormsModule, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Usuarios</h1>
        <p class="sub muted">{{ rows().length }} usuarios del sistema</p>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-primary" (click)="openForm(null)">
          <ui-icon name="plus" [size]="16" /> Nuevo usuario
        </button>
      </div>
    </div>

    <div class="card table-card">
      <table class="tbl">
        <thead>
          <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Último acceso</th><th style="width:90px"></th></tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td><b>{{ r.name }}</b></td>
              <td class="muted">{{ r.email }}</td>
              <td><span class="badge {{ roleClass(r.role) }}">{{ roleLabel(r.role) }}</span></td>
              <td class="muted">{{ r.last_login?.slice(0, 16) || 'Nunca' }}</td>
              <td class="row-actions">
                <button type="button" class="icon-btn" title="Editar" (click)="openForm(r)"><ui-icon name="edit" /></button>
                @if (r.id !== auth.user()?.id) {
                  <button type="button" class="icon-btn danger" title="Desactivar" (click)="remove(r)"><ui-icon name="trash" /></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <ui-modal [open]="formOpen()" [title]="editingId() ? 'Editar usuario' : 'Nuevo usuario'" (closed)="formOpen.set(false)">
      <div class="form-grid">
        <label class="field span2"><span>Nombre *</span><input name="uname" [(ngModel)]="draft.name" /></label>
        <label class="field"><span>Email *</span><input name="uemail" type="email" [(ngModel)]="draft.email" /></label>
        <label class="field"><span>Rol</span>
          <select name="urole" [(ngModel)]="draft.role">
            <option value="admin">Administrador</option>
            <option value="sales">Ventas</option>
            <option value="purchase">Compras</option>
            <option value="accounting">Contabilidad</option>
          </select>
        </label>
        <label class="field"><span>Contraseña {{ editingId() ? '(vacío = sin cambios)' : '*' }}</span>
          <input name="upass" type="password" [(ngModel)]="draft.password" autocomplete="new-password" />
        </label>
        <label class="check"><input type="checkbox" name="uactive" [(ngModel)]="draft.active" /> Activo</label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
        <button type="button" class="btn btn-primary" (click)="save()">Guardar</button>
      </div>
    </ui-modal>
  `,
})
export class UsersPage {
  private api = inject(Api);
  private toast = inject(Toast);
  protected readonly auth = inject(AuthStore);

  protected readonly rows = signal<any[]>([]);
  protected readonly formOpen = signal(false);
  protected editingId = signal<number | null>(null);
  protected draft: any = {};

  constructor() {
    this.load();
  }

  protected load(): void {
    this.api.get<any[]>('/users').subscribe({ next: (r) => this.rows.set(r) });
  }

  protected openForm(u: any): void {
    this.editingId.set(u ? u.id : null);
    this.draft = u
      ? { ...u, active: !!u.active, password: '' }
      : { name: '', email: '', role: 'sales', password: '', active: true };
    this.formOpen.set(true);
  }

  protected save(): void {
    if (!this.draft.name?.trim() || !this.draft.email?.trim()) return this.toast.error('Nombre y email son obligatorios');
    if (!this.editingId() && !this.draft.password) return this.toast.error('Define una contraseña inicial');
    const body = { ...this.draft };
    if (!body.password) delete body.password;
    const obs = this.editingId()
      ? this.api.put(`/users/${this.editingId()}`, body)
      : this.api.post('/users', body);
    obs.subscribe({
      next: () => {
        this.toast.ok('Usuario guardado');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected remove(u: any): void {
    if (!confirm(`¿Desactivar el usuario "${u.name}"?`)) return;
    this.api.delete(`/users/${u.id}`).subscribe({
      next: () => {
        this.toast.ok('Usuario desactivado');
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected roleLabel(r: string): string {
    const m: Record<string, string> = { admin: 'Administrador', sales: 'Ventas', purchase: 'Compras', accounting: 'Contabilidad' };
    return m[r] ?? r;
  }

  protected roleClass(r: string): string {
    const m: Record<string, string> = { admin: 'red', sales: 'green', purchase: 'purple', accounting: 'amber' };
    return m[r] ?? 'gray';
  }
}
