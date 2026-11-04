import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../../shared/pipes/currency-pen.pipe';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../../core/models/product.model';
import { MesaSalon } from '../../../../core/models/table.model';
import { ManualOrderForm } from '../../models/admin-forms';
import { getCodeNum } from '../../shared/admin-format.util';

/**
 * Modal de orden manual / segunda ronda de salón. Presentacional: edita un borrador local
 * (copia de `initial`) y emite el resultado; no llama a ningún servicio.
 */
@Component({
  selector: 'app-manual-order-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  template: `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div class="w-full max-w-lg bg-slate-900 border border-polleria-gold/40 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100 animate-scale-up">
            
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 class="font-display text-xl font-bold text-white">
                @if (draft.modo === 'AGREGAR') {
                  Agregar platos a la comanda #{{ getCodeNum(draft.ordenId || '') }}
                } @else if (draft.tipo === 'SALON') {
                  Tomar comanda de salón
                } @else {
                  Registrar Nueva Orden Manual
                }
              </h3>
              <button (click)="closed.emit()" class="text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>

            <div class="space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Tipo de Pedido:</label>
                  <select 
                    [(ngModel)]="draft.tipo"
                    [disabled]="draft.modo === 'AGREGAR'"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="DELIVERY">Delivery</option>
                    <option value="SALON">Salón</option>
                    <option value="RECOJO">Recojo en Tienda</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Método de Pago:</label>
                  <select 
                    [(ngModel)]="draft.metodoPago"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="YAPE">Yape / Plin</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
              </div>

              @if (draft.modo === 'AGREGAR' && draft.ordenId) {
                <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-200 leading-snug">
                  Segunda ronda sobre la comanda <strong>#{{ getCodeNum(draft.ordenId) }}</strong>.
                  Los platos se suman a la misma orden y la cocina vuelve a prepararla.
                </div>
              }

              @if (draft.tipo === 'SALON') {
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Mesa:</label>
                  <select 
                    [(ngModel)]="draft.mesaId"
                    [disabled]="draft.modo === 'AGREGAR'"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option [ngValue]="null">Seleccioná una mesa</option>
                    @for (m of mesas(); track m.id) {
                      <option [ngValue]="m.id">
                        Mesa {{ m.numero }} — {{ m.estado }}{{ m.ordenActiva ? ' (comanda #' + m.ordenActiva.ordenId + ')' : '' }}
                      </option>
                    }
                  </select>
                  @if (mesas().length === 0) {
                    <p class="text-[11px] text-amber-300 mt-1">No hay mesas registradas. Creá una en la pestaña Mesas.</p>
                  }
                </div>
              } @else {
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-400 mb-1">Nombre del Cliente:</label>
                    <input 
                      type="text" 
                      [(ngModel)]="draft.clienteNombre"
                      placeholder="Ej. Juan Pérez"
                      class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-400 mb-1">Teléfono:</label>
                    <input 
                      type="text" 
                      [(ngModel)]="draft.clienteCelular"
                      placeholder="987654321"
                      class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                    />
                  </div>
                </div>
              }

              @if (draft.tipo === 'DELIVERY' && draft.modo === 'CREAR') {
                <div>
                  <label class="block font-bold text-slate-400 mb-1">Dirección de Entrega:</label>
                  <input 
                    type="text" 
                    [(ngModel)]="draft.direccion"
                    placeholder="Av. Los Maestros 450, Dpto 201"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              }

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                  <label class="block font-bold text-slate-400 mb-1">Plato / Combo:</label>
                  <select 
                    [(ngModel)]="draft.selectedProductId"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  >
                    @for (p of products(); track p.id) {
                      <option [value]="p.id">{{ p.nombre }} - {{ p.precio | currencyPEN }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-400 mb-1">Cantidad:</label>
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    [(ngModel)]="draft.cantidad"
                    class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                  />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-400 mb-1">Notas de Preparación / Observaciones:</label>
                <input 
                  type="text" 
                  [(ngModel)]="draft.notas"
                  placeholder="Papas bien doradas, sin mayonesa..."
                  class="w-full p-2.5 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-polleria-gold"
                />
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button 
                (click)="closed.emit()" 
                class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                (click)="confirmed.emit(draft)" 
                class="px-5 py-2 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover text-white text-xs font-bold transition cursor-pointer shadow"
              >
                @if (draft.modo === 'AGREGAR') {
                  Agregar a la comanda
                } @else if (draft.tipo === 'SALON') {
                  Tomar comanda
                } @else {
                  Crear Pedido
                }
              </button>
            </div>

          </div>
        </div>
  `
})
export class ManualOrderModalComponent implements OnInit {
  readonly initial = input.required<ManualOrderForm>();
  readonly mesas = input.required<MesaSalon[]>();
  readonly products = input.required<Product[]>();

  readonly closed = output<void>();
  readonly confirmed = output<ManualOrderForm>();

  protected draft!: ManualOrderForm;
  protected readonly getCodeNum = getCodeNum;

  ngOnInit(): void {
    this.draft = { ...this.initial() };
  }
}
