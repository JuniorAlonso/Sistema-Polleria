import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus, OrderType } from '../../../core/models/order.model';

interface Step {
  id: OrderStatus;
  title: string;
  desc: string;
  icon: string;
}

@Component({
  selector: 'app-order-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full py-4">
      <div class="relative">
        <!-- Progress track background -->
        <div class="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 md:left-0 md:top-1/2 md:w-full md:h-0.5 md:-translate-y-1/2"></div>
        
        <!-- Active Progress track -->
        <div 
          class="absolute left-6 top-6 w-0.5 bg-brand-500 transition-all duration-500 md:left-0 md:top-1/2 md:h-0.5 md:-translate-y-1/2"
          [style.height]="progressPercentageVertical()"
          [style.width]="progressPercentageHorizontal()"
        ></div>

        <!-- Steps list -->
        <div class="relative flex flex-col md:flex-row justify-between gap-6 md:gap-2">
          @for (step of steps(); track step.id; let i = $index) {
            <div class="flex md:flex-col items-start md:items-center gap-4 md:gap-2 text-left md:text-center group">
              <!-- Step indicator icon / number -->
              <div 
                class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 shadow-md shrink-0 z-10"
                [ngClass]="{
                  'bg-brand-500 text-white ring-4 ring-brand-100 scale-110 shadow-brand-500/25': isCurrent(step.id),
                  'bg-emerald-600 text-white': isPassed(i),
                  'bg-white text-slate-400 border-2 border-slate-200': isFuture(i)
                }"
              >
                @if (isPassed(i)) {
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                } @else {
                  <span>{{ i + 1 }}</span>
                }
              </div>

              <!-- Step Labels -->
              <div>
                <p class="font-bold text-sm" [ngClass]="isPassed(i) || isCurrent(step.id) ? 'text-slate-900' : 'text-slate-400'">
                  {{ step.title }}
                </p>
                <p class="text-xs text-slate-500 max-w-[140px]">
                  {{ step.desc }}
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class OrderTimelineComponent {
  readonly status = input.required<OrderStatus>();
  readonly orderType = input<OrderType>('DELIVERY');

  readonly steps = computed<Step[]>(() => {
    const isDelivery = this.orderType() === 'DELIVERY';
    return [
      {
        id: 'PENDIENTE_PAGO',
        title: 'Confirmación',
        desc: 'Pedido recibido en sistema',
        icon: 'clock'
      },
      {
        id: 'PAGADO',
        title: 'Pago Validado',
        desc: 'Orden aprobada',
        icon: 'check'
      },
      {
        id: 'EN_PREPARACION',
        title: 'En Cocina',
        desc: 'Dorando al carbón',
        icon: 'flame'
      },
      {
        id: isDelivery ? 'EN_REPARTO' : 'LISTO_COCINA',
        title: isDelivery ? 'En Reparto' : 'Listo para Servir',
        desc: isDelivery ? 'Motorizado en camino' : 'Listo en barra/mesa',
        icon: isDelivery ? 'truck' : 'utensils'
      },
      {
        id: 'COMPLETADO',
        title: 'Completado',
        desc: '¡Buen provecho!',
        icon: 'sparkles'
      }
    ];
  });

  private readonly statusRank: Record<OrderStatus, number> = {
    'PENDIENTE_PAGO': 0,
    'PAGADO': 1,
    'EN_PREPARACION': 2,
    'LISTO_COCINA': 3,
    'EN_REPARTO': 3,
    'COMPLETADO': 4,
    'CANCELADO': -1
  };

  readonly currentStepIndex = computed(() => {
    return this.statusRank[this.status()] ?? 0;
  });

  isCurrent(stepStatus: OrderStatus): boolean {
    if (this.status() === 'LISTO_COCINA' && (stepStatus === 'LISTO_COCINA' || stepStatus === 'EN_REPARTO')) return true;
    return this.status() === stepStatus;
  }

  isPassed(index: number): boolean {
    return index < this.currentStepIndex();
  }

  isFuture(index: number): boolean {
    return index > this.currentStepIndex();
  }

  readonly progressPercentageHorizontal = computed(() => {
    const idx = this.currentStepIndex();
    if (idx <= 0) return '0%';
    const pct = (idx / 4) * 100;
    return `${Math.min(100, pct)}%`;
  });

  readonly progressPercentageVertical = computed(() => {
    const idx = this.currentStepIndex();
    if (idx <= 0) return '0%';
    const pct = (idx / 4) * 100;
    return `${Math.min(100, pct)}%`;
  });
}
