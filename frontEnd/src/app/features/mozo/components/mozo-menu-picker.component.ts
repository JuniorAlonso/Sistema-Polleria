import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Product } from '../../../core/models/product.model';
import { MesaSalon } from '../mozo.types';

@Component({
  selector: 'app-mozo-menu-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block lg:col-span-2 space-y-4' },
  template: `
                <div class="bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h2 class="text-lg font-bold text-white">Carta Digital de Salón</h2>
                    <p class="text-xs text-slate-400">Selecciona platos y bebidas para la mesa elegida.</p>
                  </div>
                  
                  <!-- Mesa Target Selector -->
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-slate-300 font-bold">Mesa:</label>
                    <select 
                      [ngModel]="selectedMesaForOrder()"
                      (ngModelChange)="mesaChange.emit($event)"
                      class="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    >
                      @for (m of mesas(); track m.id) {
                        <option [value]="m.id">{{ m.nombre }} ({{ m.estado }})</option>
                      }
                    </select>
                  </div>
                </div>

                <!-- Products Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  @for (prod of products(); track prod.id) {
                    <div class="p-4 rounded-2xl bg-[#14161a] border border-white/10 flex flex-col justify-between gap-3 shadow hover:border-polleria-gold/40 transition">
                      <div class="flex items-center gap-3">
                        <img [src]="prod.imagenUrl" [alt]="prod.nombre" class="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-800"/>
                        <div class="min-w-0">
                          <h3 class="text-sm font-bold text-white truncate">{{ prod.nombre }}</h3>
                          <p class="text-xs text-slate-400 line-clamp-1">{{ prod.descripcion }}</p>
                          <span class="font-display text-sm font-bold text-polleria-gold">{{ prod.precio | currencyPEN }}</span>
                        </div>
                      </div>
                      <button 
                        (click)="agregar.emit(prod)"
                        class="w-full py-2 rounded-xl bg-polleria-gold/10 hover:bg-polleria-gold text-polleria-gold hover:text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>+ Agregar a la comanda</span>
                      </button>
                    </div>
                  }
                </div>
  `
})
export class MozoMenuPickerComponent {
  readonly mesas = input.required<MesaSalon[]>();
  readonly products = input.required<Product[]>();
  readonly selectedMesaForOrder = input.required<number | string>();

  readonly mesaChange = output<number | string>();
  readonly agregar = output<Product>();
}
