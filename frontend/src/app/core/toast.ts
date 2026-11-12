import { Injectable, signal } from '@angular/core';

export interface ToastMsg {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class Toast {
  readonly list = signal<ToastMsg[]>([]);
  private seq = 0;

  ok(text: string): void {
    this.push(text, 'ok');
  }

  error(text: string): void {
    this.push(text, 'error');
  }

  remove(id: number): void {
    this.list.update((l) => l.filter((t) => t.id !== id));
  }

  private push(text: string, kind: 'ok' | 'error'): void {
    const id = ++this.seq;
    this.list.update((l) => [...l, { id, kind, text }]);
    setTimeout(() => this.remove(id), 4200);
  }
}
