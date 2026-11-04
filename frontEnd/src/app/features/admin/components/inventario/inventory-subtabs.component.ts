import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventarioSubTab } from '../../models/admin-forms';

/** Título y selector de sub-pestañas de Inventario. Presentacional. */
@Component({
  selector: 'app-inventory-subtabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white">Inventario & Carta de Productos</h2>
              <p class="text-xs text-slate-400">Control de platos de la carta, disponibilidad y gestión de insumos.</p>
            </div>

            <div class="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button 
                (click)="subTabChange.emit('CARTA')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'CARTA' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Carta & Precios
              </button>
              <button 
                (click)="subTabChange.emit('INSUMOS')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'INSUMOS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Insumos & Lotes
              </button>
              <button 
                (click)="subTabChange.emit('MERMAS')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'MERMAS' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Mermas Diarias
              </button>
              <button 
                (click)="subTabChange.emit('PREDICCION')"
                class="px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                [ngClass]="inventarioSubTab() === 'PREDICCION' ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white'"
              >
                Alertas
              </button>
            </div>
          </div>
  `
})
export class InventorySubtabsComponent {
  readonly inventarioSubTab = input.required<InventarioSubTab>();

  readonly subTabChange = output<InventarioSubTab>();
}
