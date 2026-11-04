import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Order } from '../../../../core/models/order.model';
import { getCodeNum } from '../../shared/admin-format.util';

/** Lista de incidencias de reparto: pedidos declarados fantasma. Presentacional. */
@Component({
  selector: 'app-ghost-orders-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-[#14161a] rounded-2xl border border-rose-500/20 overflow-hidden shadow-xl">
      <div class="p-4 border-b border-white/10 flex justify-between items-center">
        <h3 class="text-sm font-bold text-white">Incidencias: pedidos fantasma</h3>
        <span class="text-xs font-mono text-rose-300">{{ pedidos().length }}</span>
      </div>
      <ul class="divide-y divide-white/5 text-xs">
        @for (order of pedidos(); track order.id) {
          <li class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span class="font-mono font-bold text-polleria-gold">#{{ getCodeNum(order.codigoSeguimiento) }}</span>
              <span class="ml-2 text-white">{{ order.cliente.nombre }}</span>
              <span class="ml-2 text-slate-500">{{ order.cliente.celular }}</span>
            </div>
            <span class="text-rose-300" data-testid="ghost-reason">{{ order.motivoFantasma || 'Sin motivo registrado' }}</span>
          </li>
        } @empty {
          <li class="p-6 text-center text-slate-500">Sin pedidos fantasma.</li>
        }
      </ul>
    </div>
  `
})
export class GhostOrdersListComponent {
  readonly pedidos = input.required<Order[]>();
  protected readonly getCodeNum = getCodeNum;
}
