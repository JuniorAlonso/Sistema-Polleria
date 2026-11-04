import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../../core/models/order.model';
import { getCodeNum, puedeDespachar } from '../../shared/admin-format.util';

/** Pedidos DELIVERY en curso y asignación de motorizado. Presentacional. */
@Component({
  selector: 'app-delivery-orders-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-4 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <span>Flota de Delivery & Asignación</span>
              </h2>
              <p class="text-xs text-slate-400">Pedidos DELIVERY en curso, tomados de orders-service (:8082).</p>
            </div>
            <div class="flex gap-2">
              <span class="px-3 py-1.5 rounded-xl bg-[#1c1f24] border border-white/10 text-xs font-mono">
                Delivery en curso: <strong class="text-polleria-gold">{{ pedidos().length }}</strong>
              </span>
              <button
                (click)="refreshRequested.emit()"
                class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
              >
                Actualizar
              </button>
            </div>
          </div>

          <p class="text-[11px] text-slate-500">
            El motorizado se elige del roster real de <strong>auth-service</strong>
            (<code>GET /auth/admin/repartidores</code>); el nombre se resuelve por id y nunca se
            inventa un repartidor ni su vehículo.
          </p>

          <div class="bg-[#14161a] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            <table class="w-full text-left text-xs">
              <thead class="bg-black/40 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th class="p-4">Pedido</th>
                  <th class="p-4">Cliente / Teléfono</th>
                  <th class="p-4">Dirección</th>
                  <th class="p-4">Estado</th>
                  <th class="p-4">Repartidor</th>
                  <th class="p-4 text-center">Asignar</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                @for (order of pedidos(); track order.id) {
                  <tr class="hover:bg-white/5 transition">
                    <td class="p-4 font-mono font-bold text-polleria-gold">#{{ getCodeNum(order.codigoSeguimiento) }}</td>
                    <td class="p-4 text-white">
                      {{ order.cliente.nombre }}
                      <span class="block text-slate-500">{{ order.cliente.celular }}</span>
                    </td>
                    <td class="p-4 text-slate-300">{{ order.cliente.direccion || '—' }}</td>
                    <td class="p-4 text-slate-300">{{ order.estado }}</td>
                    <td class="p-4">
                      @if (order.repartidorId) {
                        <span class="text-emerald-400 font-bold">{{ nombreMotorizado(order) }}</span>
                      } @else {
                        <span class="text-amber-300 font-bold">Por asignar</span>
                      }
                    </td>
                    <td class="p-4 text-center">
                      @if (puedeDespachar(order)) {
                        <button
                          (click)="assignRequested.emit(order)"
                          class="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span>🛵</span>
                          <span>{{ order.repartidorId ? 'Reasignar (' + nombreMotorizado(order) + ')' : 'Asignar motorizado' }}</span>
                        </button>
                      } @else {
                        <span class="block text-[11px] text-slate-500">
                          Se habilita cuando la cocina lo marque LISTO
                        </span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="p-8 text-center text-slate-500">
                      No hay pedidos de delivery en curso.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
  `
})
export class DeliveryOrdersTableComponent {
  readonly pedidos = input.required<Order[]>();
  /** Nombre real del motorizado por id (roster de auth-service). */
  readonly motorizadoNames = input.required<Record<number, string>>();

  readonly refreshRequested = output<void>();
  readonly assignRequested = output<Order>();

  protected readonly getCodeNum = getCodeNum;
  protected readonly puedeDespachar = puedeDespachar;

  /** Sin roster se muestra el id: nunca un nombre inventado. */
  protected nombreMotorizado(order: Order): string {
    const id = order.repartidorId;
    if (id == null) return 'Por asignar';
    return this.motorizadoNames()[id] ?? `Motorizado #${id}`;
  }
}
