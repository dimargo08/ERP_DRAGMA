import { Component, input } from '@angular/core';

/**
 * Muestra el logotipo oficial de Dragma (public/logo.png).
 * - Conserva proporciones originales (object-fit: contain), nunca se deforma.
 * - Variante `plate` (host class): fondo blanco redondeado para usarlo sobre
 *   superficies oscuras (sidebar) sin alterar sus colores.
 */
@Component({
  selector: 'ui-logo',
  template: `
    <img
      class="logo-img"
      src="logo.png"
      alt="Dragma ERP"
      draggable="false"
      [attr.width]="size()"
      [attr.height]="size()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    :host(.plate) {
      background: #ffffff;
      border-radius: 10px;
      padding: 4px 6px;
      box-shadow: inset 0 0 0 1px rgba(229, 231, 235, 0.7);
    }
    .logo-img {
      display: block;
      object-fit: contain;
      max-width: 100%;
      height: auto;
      width: auto;
      max-height: var(--logo-max, none);
    }
  `,
})
export class UiLogo {
  size = input(28);
}
