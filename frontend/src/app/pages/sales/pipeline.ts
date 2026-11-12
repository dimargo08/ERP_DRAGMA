import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Toast } from '../../core/toast';
import { UiIcon } from '../../shared/icon';
import { UiModal } from '../../shared/modal';

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface Deal {
  id: number;
  title: string;
  partner_id: number | null;
  partner_name?: string | null;
  amount: number;
  stage: string;
  notes: string | null;
  sort_order: number;
  updated_at?: string;
}

const STAGES: Stage[] = [
  { id: 'prospect', label: 'EN PROSPECTO', color: '#64748b' },
  { id: 'ai_proposal', label: 'PROPUESTA IA', color: '#2563eb' },
  { id: 'draga_design', label: 'DRAGMA DISEÑADOR', color: '#7c3aed' },
  { id: 'quote', label: 'COTIZACIÓN', color: '#d97706' },
  { id: 'won', label: 'GANADO', color: '#16a34a' },
  { id: 'lost', label: 'PERDIDO', color: '#dc2626' },
];

@Component({
  selector: 'app-pipeline',
  imports: [FormsModule, DecimalPipe, RouterLink, UiModal, UiIcon],
  template: `
    <div class="toolbar">
      <div>
        <h1>Embudo de ventas</h1>
        <p class="sub muted">{{ deals().length }} oportunidades · {{ openTotal() | number: '1.0-0' }} € en juego</p>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-primary" (click)="openForm(null, 'prospect')">
          <ui-icon name="plus" [size]="16" /> Nueva oportunidad
        </button>
      </div>
    </div>

    <div class="view-tabs">
      <a routerLink="/sales" class="view-tab"><ui-icon name="receipt" [size]="15" /> Pedidos</a>
      <a routerLink="/sales/pipeline" class="view-tab active"><ui-icon name="dashboard" [size]="15" /> Embudo</a>
      <span class="view-hint">Arrastra las tarjetas entre etapas</span>
    </div>

    <div class="board">
      @for (s of stages; track s.id) {
        <section
          class="kcol"
          [style.--stage]="s.color"
          [class.drag-over]="dragOver() === s.id"
          (dragover)="onColumnOver($event, s.id)"
          (dragleave)="onColumnLeave($event)"
          (drop)="onDropColumn($event, s.id)"
        >
          <header class="kcol-head">
            <span class="kcol-dot"></span>
            <h3>{{ s.label }}</h3>
            <span class="kcol-count">{{ byStage(s.id).length }}</span>
          </header>
          <div class="kcol-total">{{ stageTotal(s.id) | number: '1.0-0' }} €</div>

          <div class="kcol-body">
            @for (d of byStage(s.id); track d.id) {
              <article
                class="deal-card"
                draggable="true"
                [class.dragging]="draggingId() === d.id"
                (dragstart)="onDragStart($event, d)"
                (dragend)="onDragEnd()"
                (dragover)="onCardOver($event, s.id)"
                (drop)="onDropCard($event, s.id, d.id)"
                (click)="openForm(d)"
              >
                <div class="deal-top">
                  <span class="deal-title">{{ d.title }}</span>
                  <ui-icon name="edit" [size]="13" />
                </div>
                <div class="deal-partner">
                  <ui-icon name="users" [size]="13" />
                  <span>{{ d.partner_name || 'Sin contacto' }}</span>
                </div>
                @if (d.notes) {
                  <p class="deal-notes">{{ d.notes }}</p>
                }
                <div class="deal-foot">
                  <b class="money">{{ amount(d) | number: '1.2-2' }} €</b>
                  <span class="deal-date">{{ shortDate(d.updated_at) }}</span>
                </div>
              </article>
            } @empty {
              <div class="kcol-empty">Suelta aquí una tarjeta</div>
            }
            <button type="button" class="kcol-add" (click)="openForm(null, s.id)">
              <ui-icon name="plus" [size]="13" /> Añadir
            </button>
          </div>
        </section>
      }
    </div>

    <ui-modal [open]="formOpen()" [title]="editingId() ? 'Editar oportunidad' : 'Nueva oportunidad'" (closed)="formOpen.set(false)">
      <div class="form-grid">
        <label class="field span2"><span>Título *</span>
          <input name="dtitle" [(ngModel)]="draft.title" placeholder="Ej: Implantación ERP para..." />
        </label>
        <label class="field span2"><span>Contacto</span>
          <select name="dpartner" [(ngModel)]="draft.partner_id">
            <option [ngValue]="null">Sin contacto</option>
            @for (p of partners(); track p.id) {
              <option [ngValue]="p.id">{{ p.name }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Importe (€)</span>
          <input name="damount" type="number" min="0" step="any" [(ngModel)]="draft.amount" />
        </label>
        <label class="field"><span>Etapa</span>
          <select name="dstage" [(ngModel)]="draft.stage">
            @for (s of stages; track s.id) {
              <option [ngValue]="s.id">{{ s.label }}</option>
            }
          </select>
        </label>
        <label class="field span2"><span>Notas</span>
          <textarea name="dnotes" rows="3" [(ngModel)]="draft.notes" placeholder="Siguiente paso, condiciones..."></textarea>
        </label>
      </div>
      <div class="modal-foot split">
        <div>
          @if (editingId()) {
            <button type="button" class="btn btn-danger btn-sm" (click)="del()"><ui-icon name="trash" [size]="14" /> Eliminar</button>
          }
        </div>
        <div class="foot-actions">
          <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">Cancelar</button>
          <button type="button" class="btn btn-primary" (click)="save()">Guardar</button>
        </div>
      </div>
    </ui-modal>
  `,
})
export class PipelinePage {
  private api = inject(Api);
  private toast = inject(Toast);

  protected readonly stages = STAGES;
  protected readonly deals = signal<Deal[]>([]);
  protected readonly partners = signal<any[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly draggingId = signal<number | null>(null);
  protected readonly dragOver = signal<string | null>(null);
  protected draft: any = {};

  private dragEndedAt = 0;

  constructor() {
    this.load();
    this.api.get<any[]>('/partners').subscribe({ next: (r) => this.partners.set(r.filter((p) => p.active)) });
  }

  protected load(): void {
    this.api.get<Deal[]>('/sales/deals').subscribe({ next: (r) => this.deals.set(r) });
  }

  protected byStage(stage: string): Deal[] {
    return this.deals().filter((d) => d.stage === stage);
  }

  protected amount(d: Deal): number {
    return Number(d.amount) || 0;
  }

  protected stageTotal(stage: string): number {
    return this.byStage(stage).reduce((acc, d) => acc + this.amount(d), 0);
  }

  protected openTotal(): number {
    return this.deals().filter((d) => d.stage !== 'lost').reduce((acc, d) => acc + this.amount(d), 0);
  }

  protected shortDate(value?: string): string {
    return value ? value.slice(0, 10) : '';
  }

  protected onDragStart(event: DragEvent, deal: Deal): void {
    this.draggingId.set(deal.id);
    this.dragOver.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(deal.id));
    }
  }

  protected onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOver.set(null);
    this.dragEndedAt = Date.now();
  }

  protected onCardOver(event: DragEvent, stage: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOver.set(stage);
  }

  protected onColumnOver(event: DragEvent, stage: string): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOver.set(stage);
  }

  protected onColumnLeave(event: DragEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.dragOver.set(null);
  }

  protected onDropCard(event: DragEvent, stage: string, beforeId: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.move(stage, beforeId);
  }

  protected onDropColumn(event: DragEvent, stage: string): void {
    event.preventDefault();
    this.move(stage, null);
  }

  private move(stage: string, beforeId: number | null): void {
    const id = this.draggingId();
    this.draggingId.set(null);
    this.dragOver.set(null);
    if (id == null) return;

    const current = this.deals().find((d) => d.id === id);
    if (!current) return;
    if (current.stage === stage) {
      const siblings = this.byStage(stage);
      const from = siblings.findIndex((d) => d.id === id);
      const to = beforeId == null ? siblings.length - 1 : siblings.findIndex((d) => d.id === beforeId);
      if (to < 0 || from === to || (beforeId === null && from === siblings.length - 1)) return;
    }

    const card = { ...current, stage, sort_order: 0 };
    let next = this.deals().filter((d) => d.id !== id);

    if (beforeId != null) {
      const idx = next.findIndex((d) => d.id === beforeId);
      next.splice(idx < 0 ? next.length : idx, 0, card);
    } else {
      const stageIndexes = next
        .map((d, i) => ({ d, i }))
        .filter((x) => x.d.stage === stage)
        .map((x) => x.i);
      const insertAt = stageIndexes.length ? stageIndexes[stageIndexes.length - 1] + 1 : next.length;
      next.splice(insertAt, 0, card);
    }

    const ordered = this.reindex(next);
    this.deals.set(ordered);
    const ids = ordered.filter((d) => d.stage === stage).map((d) => d.id);

    this.api.post(`/sales/deals/${id}/move`, { stage, ids }).subscribe({
      error: (e: Error) => {
        this.toast.error(e.message);
        this.load();
      },
    });
  }

  private reindex(list: Deal[]): Deal[] {
    const counters: Record<string, number> = {};
    return list.map((d) => ({
      ...d,
      sort_order: (counters[d.stage] = (counters[d.stage] ?? -1) + 1),
    }));
  }

  protected openForm(deal: Deal | null, stage = 'prospect'): void {
    if (Date.now() - this.dragEndedAt < 250) return;
    this.editingId.set(deal ? deal.id : null);
    this.draft = deal
      ? { title: deal.title, partner_id: deal.partner_id ?? null, amount: this.amount(deal), stage: deal.stage, notes: deal.notes ?? '' }
      : { title: '', partner_id: null, amount: 0, stage, notes: '' };
    this.formOpen.set(true);
  }

  protected save(): void {
    if (!this.draft.title?.trim()) return this.toast.error('El título es obligatorio');
    const body = {
      title: this.draft.title.trim(),
      partner_id: this.draft.partner_id ?? null,
      amount: Number(this.draft.amount) || 0,
      stage: this.draft.stage,
      notes: this.draft.notes?.trim() || null,
    };
    const obs = this.editingId()
      ? this.api.put(`/sales/deals/${this.editingId()}`, body)
      : this.api.post('/sales/deals', body);
    obs.subscribe({
      next: () => {
        this.toast.ok(this.editingId() ? 'Oportunidad actualizada' : 'Oportunidad creada');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }

  protected del(): void {
    if (!confirm('¿Eliminar esta oportunidad?')) return;
    this.api.delete(`/sales/deals/${this.editingId()}`).subscribe({
      next: () => {
        this.toast.ok('Oportunidad eliminada');
        this.formOpen.set(false);
        this.load();
      },
      error: (e: Error) => this.toast.error(e.message),
    });
  }
}
