import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus } from '../../../core/models/order.model';

@Component({
  selector: 'app-order-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="badgeClasses()">
      <span class="w-2 h-2 rounded-full mr-1.5" [class]="dotClasses()"></span>
      {{ statusLabel() }}
    </span>
  `
})
export class OrderStatusBadgeComponent {
  readonly status = input.required<OrderStatus>();

  readonly statusConfig = computed(() => {
    const s = this.status();
    switch (s) {
      case 'PENDIENTE_PAGO':
        return {
          label: 'Pendiente de Pago',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500 animate-pulse'
        };
      case 'PAGADO':
        return {
          label: 'Pago Confirmado',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-500'
        };
      case 'EN_PREPARACION':
        return {
          label: 'En Preparación (Cocina)',
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          dot: 'bg-orange-500 animate-pulse'
        };
      case 'LISTO_COCINA':
        return {
          label: 'Listo en Cocina',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500'
        };
      case 'EN_REPARTO':
        return {
          label: 'En Camino / Reparto',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500 animate-bounce'
        };
      case 'COMPLETADO':
        return {
          label: 'Entregado / Completado',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'CANCELADO':
        return {
          label: 'Cancelado',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500'
        };
      default:
        return {
          label: s,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400'
        };
    }
  });

  readonly badgeClasses = computed(() =>
    `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-xs ${this.statusConfig().bg}`
  );

  readonly dotClasses = computed(() => this.statusConfig().dot);
  readonly statusLabel = computed(() => this.statusConfig().label);
}
