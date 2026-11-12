import { Component, input, output } from '@angular/core';
import { UiIcon } from './icon';

@Component({
  selector: 'ui-modal',
  imports: [UiIcon],
  template: `
    @if (open()) {
      <div class="modal-backdrop" (click)="closed.emit()">
        <div class="modal" [class.modal-lg]="large()" (click)="$event.stopPropagation()">
          <header class="modal-head">
            <h3>{{ title() }}</h3>
            <button type="button" class="icon-btn" aria-label="Cerrar" (click)="closed.emit()">
              <ui-icon name="close" />
            </button>
          </header>
          <div class="modal-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
})
export class UiModal {
  open = input.required<boolean>();
  title = input('');
  large = input(false);
  closed = output<void>();
}
