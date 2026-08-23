import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { OrdersService } from '../../../core/services/orders.service';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { Order } from '../../../core/models/order.model';

@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CurrencyPENPipe],
  template: `
    <div class="min-h-screen bg-[#0f1013] text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-polleria-gold selection:text-slate-900">
      
      <!-- Subtle Ambient Map & Heat Glow Background (Visual Polish) -->
      <div class="absolute inset-0 bg-radial-vignette pointer-events-none opacity-60"></div>
      <div class="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="max-w-4xl mx-auto space-y-10 relative z-10 animate-slide-up">
        
        <!-- ================= TOP HEADER (FIGMA EXACT) ================= -->
        <div class="text-center space-y-3">
          
          <!-- Order Code Badge -->
          <div class="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-slate-400">
            <span>ORDEN #{{ currentOrder()?.codigoSeguimiento?.replace('POL-', '') || '8275' }}</span>
          </div>

          <!-- Main Slogan Display -->
          <h1 class="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-wide uppercase text-polleria-gold drop-shadow-[0_2px_15px_rgba(245,158,11,0.35)] leading-tight">
            EL FUEGO ESTÁ EN CAMINO
          </h1>

          <!-- Subtitle Delivery Time -->
          <p class="text-slate-300 text-sm sm:text-base font-normal tracking-wide">
            Tiempo estimado de entrega: <strong class="text-white font-bold">25 min</strong>
          </p>

        </div>


        <!-- ================= GLOWING STEPPER PROGRESS CARD (FIGMA EXACT) ================= -->
        <div class="p-6 sm:p-10 rounded-3xl bg-[#181a1e]/90 border border-white/10 shadow-2xl backdrop-blur-md">
          
          <div class="relative">
            
            <!-- Progress Connecting Line Track -->
            <div class="hidden sm:block absolute top-7 left-12 right-12 h-1 bg-slate-800 rounded-full">
              <!-- Active Progress Golden Glow Bar -->
              <div 
                class="h-full bg-polleria-gold shadow-[0_0_15px_rgba(245,158,11,0.8)] rounded-full transition-all duration-700 ease-out"
                [style.width]="getStepProgressWidth()"
              ></div>
            </div>

            <!-- Steps Grid (4 Steps Figma Exact) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 relative z-10">
              
              <!-- STEP 1: RECIBIDO (Figma Exact) -->
              <div class="flex flex-col items-center text-center space-y-3">
                <!-- Golden Icon Circle -->
                <div class="w-14 h-14 rounded-full bg-polleria-gold text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl sm:text-2xl text-white tracking-wide uppercase">
                    Recibido
                  </h3>
                  <p class="text-xs text-slate-400 font-mono mt-0.5">19:30</p>
                </div>
              </div>

              <!-- STEP 2: EN PREPARACIÓN (Figma Exact) -->
              <div class="flex flex-col items-center text-center space-y-3">
                <!-- Golden Icon Circle -->
                <div class="w-14 h-14 rounded-full bg-polleria-gold text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl sm:text-2xl text-white tracking-wide uppercase">
                    En preparación
                  </h3>
                  <p class="text-xs text-slate-400 font-mono mt-0.5">19:45</p>
                </div>
              </div>

              <!-- STEP 3: EN CAMINO (ACTIVE - Figma Exact) -->
              <div class="flex flex-col items-center text-center space-y-3">
                <!-- Black Circle with Golden Border & Glowing Ring -->
                <div class="w-14 h-14 rounded-full bg-black border-2 border-polleria-gold text-polleria-gold flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse-subtle">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2m-6 0a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl sm:text-2xl text-polleria-gold tracking-wide uppercase font-bold">
                    En camino
                  </h3>
                  <p class="text-xs text-polleria-gold font-bold mt-0.5 animate-pulse">Justo ahora</p>
                </div>
              </div>

              <!-- STEP 4: ENTREGADO / RECIBIDO (Figma Exact) -->
              <div class="flex flex-col items-center text-center space-y-3 opacity-60">
                <!-- Dark Gray Circle -->
                <div class="w-14 h-14 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center border border-slate-700">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-display text-xl sm:text-2xl text-slate-400 tracking-wide uppercase">
                    Recibido
                  </h3>
                  <p class="text-xs text-slate-600 font-mono mt-0.5">--:--</p>
                </div>
              </div>

            </div>

          </div>

        </div>


        <!-- ================= BOTTOM ACTION BUTTONS (FIGMA EXACT) ================= -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          <!-- Button 1: CONTACTAR CON EL RIDER (Figma Exact) -->
          <button 
            type="button"
            (click)="contactRider()"
            class="w-full py-4 px-6 rounded-xl border-2 border-polleria-gold bg-[#141618] hover:bg-white/5 active:scale-98 text-polleria-gold font-display text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            <span>CONTACTAR CON EL RIDER</span>
          </button>

          <!-- Button 2: VER DETALLES (Figma Exact) -->
          <button 
            type="button"
            (click)="toggleDetailsModal(true)"
            class="w-full py-4 px-6 rounded-xl bg-polleria-crimson hover:bg-[#a81125] active:scale-98 text-white font-display text-xl tracking-wider uppercase font-bold transition duration-200 shadow-lg shadow-black/60 flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span>VER DETALLES</span>
          </button>

        </div>


        <!-- Search other order code shortcut -->
        <div class="pt-4 text-center">
          <form (ngSubmit)="searchOrder()" class="inline-flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10">
            <input 
              type="text" 
              [(ngModel)]="searchCode" 
              name="searchCode"
              placeholder="Consultar otro código..." 
              class="px-4 py-1.5 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none uppercase font-mono tracking-wider w-44"
            />
            <button type="submit" class="px-3.5 py-1.5 rounded-full bg-polleria-gold text-slate-950 text-xs font-bold uppercase cursor-pointer hover:bg-amber-400">
              Buscar
            </button>
          </form>
        </div>

      </div>


      <!-- ================= DETAILS MODAL ================= -->
      @if (showDetailsModal()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div class="w-full max-w-lg bg-[#181a1e] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-6 animate-slide-up text-white">
            
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 class="font-display text-2xl uppercase tracking-wider text-polleria-gold">
                  Detalle de Comanda #{{ currentOrder()?.codigoSeguimiento }}
                </h3>
                <p class="text-xs text-slate-400">Dirección: {{ currentOrder()?.cliente?.direccion || 'Av. Larco 1234, Miraflores' }}</p>
              </div>
              <button 
                (click)="toggleDetailsModal(false)"
                class="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Items List -->
            <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
              @for (item of currentOrder()?.items; track item.product.id) {
                <div class="flex items-center justify-between text-xs py-2 border-b border-slate-800/60">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-0.5 rounded bg-polleria-crimson text-white font-mono font-bold">{{ item.cantidad }}x</span>
                    <span class="font-bold text-slate-200">{{ item.product.nombre }}</span>
                  </div>
                  <span class="font-bold text-polleria-gold">{{ item.subtotal | currencyPEN }}</span>
                </div>
              }
            </div>

            <!-- Totals Breakdown -->
            <div class="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div class="flex justify-between">
                <span>Subtotal:</span>
                <span>{{ currentOrder()?.subtotal | currencyPEN }}</span>
              </div>
              <div class="flex justify-between">
                <span>Delivery:</span>
                <span>{{ currentOrder()?.costoEnvio | currencyPEN }}</span>
              </div>
              <div class="flex justify-between pt-2 border-t border-slate-700 text-sm font-bold text-white">
                <span>Total Facturado:</span>
                <span class="text-polleria-gold font-display text-xl">{{ currentOrder()?.total | currencyPEN }}</span>
              </div>
            </div>

            <button 
              type="button"
              (click)="toggleDetailsModal(false)"
              class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase cursor-pointer"
            >
              Cerrar
            </button>

          </div>
        </div>
      }

    </div>
  `
})
export class OrderTrackingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private ordersService = inject(OrdersService);
  private notify = inject(NotificationService);

  readonly currentOrder = signal<Order | null>(null);
  readonly showDetailsModal = signal<boolean>(false);
  searchCode = 'POL-8275';

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['code']) {
        this.searchCode = params['code'];
      }
      this.loadOrder();
    });
  }

  loadOrder(): void {
    let found = this.ordersService.getOrderByTrackingCode(this.searchCode);
    if (!found) {
      // Fallback demo order matching Figma #8275
      found = {
        id: 'ord-8275',
        codigoSeguimiento: 'POL-8275',
        cliente: {
          nombre: 'Juan Pérez',
          celular: '987654321',
          direccion: 'Av. Larco 1234, Miraflores',
          referencia: 'Timbre 301'
        },
        items: [
          {
            product: {
              id: 'prod-1',
              nombre: 'Pollo Entero a la Brasa',
              descripcion: 'Con papas fritas y ensalada clásica.',
              precio: 65.00,
              imagenUrl: '/assets/images/hero-panoramic.jpg',
              categoria: 'POLLOS_A_LA_BRASA',
              agotado: false
            },
            cantidad: 1,
            subtotal: 65.00
          },
          {
            product: {
              id: 'prod-6',
              nombre: 'Papas Fritas Extra',
              descripcion: 'Porción familiar.',
              precio: 15.00,
              imagenUrl: '/assets/images/medio-pollo.jpg',
              categoria: 'PIQUEOS_Y_BEBIDAS',
              agotado: false
            },
            cantidad: 1,
            subtotal: 15.00
          },
          {
            product: {
              id: 'prod-8',
              nombre: 'Jarra Chicha Morada',
              descripcion: '1.5 Litros, helada.',
              precio: 20.00,
              imagenUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
              categoria: 'PIQUEOS_Y_BEBIDAS',
              agotado: false
            },
            cantidad: 1,
            subtotal: 20.00
          }
        ],
        tipo: 'DELIVERY',
        estado: 'EN_REPARTO',
        metodoPago: 'TARJETA',
        subtotal: 100.00,
        costoEnvio: 8.00,
        descuento: 0,
        total: 123.00,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.ordersService.createOrder(found);
    }
    this.currentOrder.set(found);
  }

  getStepProgressWidth(): string {
    const status = this.currentOrder()?.estado;
    switch (status) {
      case 'PENDIENTE_PAGO':
        return '0%';
      case 'PAGADO':
        return '25%';
      case 'EN_PREPARACION':
        return '50%';
      case 'LISTO_COCINA':
      case 'EN_REPARTO':
        return '75%';
      case 'COMPLETADO':
        return '100%';
      default:
        return '75%';
    }
  }

  toggleDetailsModal(open: boolean): void {
    this.showDetailsModal.set(open);
  }

  contactRider(): void {
    this.notify.showInfo(
      'Contacto con Motorizado San Pollo',
      'Llamando al Rider: Carlos M. (+51 987 112 233) asignado a la moto placa 4589-3A'
    );
  }

  searchOrder(): void {
    if (!this.searchCode) return;
    const found = this.ordersService.getOrderByTrackingCode(this.searchCode);
    if (found) {
      this.currentOrder.set(found);
      this.notify.showSuccess(`Orden ${found.codigoSeguimiento} cargada`);
    } else {
      this.loadOrder();
      this.notify.showInfo(`Mostrando simulación para ${this.searchCode}`);
    }
  }
}
