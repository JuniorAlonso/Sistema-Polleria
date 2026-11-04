import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { Product } from '../../../../core/models/product.model';

/** Catálogo de la carta. Presentacional: toda acción sale como evento. */
@Component({
  selector: 'app-products-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CurrencyPENPipe],
  template: `
            <div class="space-y-4">
              <div class="flex justify-between items-center bg-[#1c1f24] p-4 rounded-xl border border-white/5">
                <div>
                  <h3 class="font-bold text-white">Catálogo de la Carta</h3>
                  <p class="text-xs text-slate-400">Los cambios de disponibilidad y precios se reflejan inmediatamente en la app del cliente.</p>
                </div>
                <button 
                  (click)="createRequested.emit()"
                  class="px-4 py-2 bg-polleria-crimson hover:bg-polleria-crimsonHover text-white font-bold text-xs rounded-xl transition shadow cursor-pointer"
                >
                  + Agregar Nuevo Plato / Combo
                </button>
              </div>

              <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                <table class="w-full text-left text-xs">
                  <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                      <th class="p-4">Plato / Combo</th>
                      <th class="p-4">Categoría</th>
                      <th class="p-4">Precio Regular</th>
                      <th class="p-4 text-center">Disponibilidad en Vivo</th>
                      <th class="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (p of products(); track p.id) {
                      <tr class="hover:bg-white/5 transition">
                        <td class="p-4 font-bold text-white flex items-center gap-3">
                          <img [src]="p.imagenUrl" class="w-9 h-9 rounded-lg object-cover bg-slate-800" />
                          <span>{{ p.nombre }}</span>
                        </td>
                        <td class="p-4 text-slate-400">{{ p.categoria }}</td>
                        <td class="p-4 font-mono font-bold text-polleria-gold">{{ p.precio | currencyPEN }}</td>
                        <td class="p-4 text-center">
                          <button 
                            (click)="availabilityToggled.emit(p.id)"
                            class="px-3.5 py-1 rounded-full text-xs font-bold transition cursor-pointer"
                            [ngClass]="p.agotado ? 'bg-rose-600/30 text-rose-400 border border-rose-500/30' : 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'"
                          >
                            {{ p.agotado ? 'AGOTADO' : 'DISPONIBLE' }}
                          </button>
                        </td>
                        <td class="p-4 text-center">
                          <button 
                            (click)="productDeleted.emit(p.id)"
                            class="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                            title="Eliminar producto"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
  `
})
export class ProductsTableComponent {
  readonly products = input.required<Product[]>();

  readonly createRequested = output<void>();
  readonly availabilityToggled = output<Product['id']>();
  readonly productDeleted = output<Product['id']>();
}
