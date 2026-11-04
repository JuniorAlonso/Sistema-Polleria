import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { Order } from '../../../core/models/order.model';
import { TableStatus } from '../../../core/models/table.model';
import { MesaSalon } from '../mozo.types';
import { esMesaParaCobrar, etiquetaEstadoComanda, horaDe, tiempoTranscurridoDesde } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-mesa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4' },
  template: `
            <div class="bg-[#14161a] w-full max-w-lg rounded-3xl border border-white/15 p-6 space-y-4 shadow-2xl">
              
              <div class="flex justify-between items-start pb-3 border-b border-white/10">
                <div>
                  <h3 class="font-display text-2xl font-bold text-white">{{ mesa().nombre }}</h3>
                  <span class="text-xs text-slate-400">{{ mesa().zona }} • Capacidad {{ mesa().capacidad }} pers.</span>
                </div>
                <button (click)="cerrar.emit()" class="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer" aria-label="Cerrar"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </div>

              <!-- Estado y Contenido de la Mesa -->
              @if (mesa().estado === 'LIBRE') {
                <!-- VISTA MODAL PARA MESA LIBRE: INICIAR COMANDA -->
                <div class="space-y-4 text-xs">
                  <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      </div>
                      <div>
                        <span class="text-xs font-bold text-white block">Mesa Libre & Lista</span>
                        <span class="text-[11px] text-emerald-300">Capacidad para {{ mesa().capacidad }} comensales</span>
                      </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                      Disponible
                    </span>
                  </div>

                  <!-- BOTÓN HERO PARA INICIAR COMANDA -->
                  <div class="p-5 rounded-2xl bg-gradient-to-br from-polleria-gold/15 via-white/5 to-transparent border border-polleria-gold/30 text-center space-y-3 shadow-lg">
                    <p class="text-xs text-slate-300 leading-relaxed">
                      ¿Deseas sentar comensales en esta mesa? Podrás seleccionar productos de la carta y enviar el pedido directamente a la cocina y horno.
                    </p>
                    <button 
                      type="button"
                      (click)="iniciarComanda.emit(mesa())"
                      class="w-full py-3.5 px-4 rounded-xl bg-polleria-crimson hover:bg-polleria-crimsonHover active:scale-[0.98] text-white font-black text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer shadow-lg shadow-polleria-crimson/25 flex items-center justify-center gap-2"
                    >
                      <svg class="w-5 h-5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                      </svg>
                      <span>+ Iniciar Comanda (Tomar Pedido)</span>
                    </button>
                  </div>

                  <!-- Opciones Secundarias -->
                  <div class="pt-2 border-t border-white/10 flex items-center justify-between text-slate-400">
                    <span class="text-[11px]">Otras operaciones:</span>
                    <div class="flex items-center gap-2">
                      <button 
                        type="button"
                        (click)="cambiarEstado.emit('RESERVADA')"
                        class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[11px] font-bold transition cursor-pointer"
                      >
                        Reservar
                      </button>
                      <button 
                        type="button"
                        (click)="cambiarEstado.emit('EN_LIMPIEZA')"
                        class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-[11px] font-bold transition cursor-pointer"
                      >
                        Limpieza
                      </button>
                    </div>
                  </div>
                </div>
              } @else {
                <!-- VISTA MODAL PARA MESAS OCUPADAS / POR COBRAR / EN ATENCIÓN -->
                <div class="space-y-3 text-xs">
                  <div class="flex justify-between items-center p-3 rounded-xl bg-white/5">
                    <span class="text-slate-300">Estado Actual:</span>
                    <span class="font-bold uppercase" [ngClass]="{
                      'text-amber-400': esMesaParaCobrar(mesa()),
                      'text-rose-400': !esMesaParaCobrar(mesa()) && mesa().estado === 'OCUPADA',
                      'text-sky-400': mesa().estado === 'EN_LIMPIEZA' || mesa().estado === 'LIMPIEZA',
                      'text-purple-400': mesa().estado === 'RESERVADA'
                    }">
                      {{ esMesaParaCobrar(mesa()) ? 'POR COBRAR' : mesa().estado }}
                    </span>
                  </div>

                  <!-- Contador de tiempo servido en el modal -->
                  @if (mesa().servidoEn || comandaMesa()?.servidoEn; as servidoIso) {
                    <div class="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs">
                      <span class="flex items-center gap-2 text-amber-200 font-medium">
                        <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Comida servida en mesa:
                      </span>
                      <span class="font-mono font-bold text-amber-300">
                        Hace {{ tiempoTranscurridoDesde(servidoIso) }} ({{ horaDe(servidoIso) }})
                      </span>
                    </div>
                  }

                  <!-- Detalle de Consumo (comanda real de la orden activa) -->
                  <div class="p-3 rounded-xl bg-black/40 space-y-2 border border-white/5">
                    <span class="font-bold text-slate-300 block">Comanda Acumulada:</span>

                    @if (comandaMesa(); as comanda) {
                      <div class="space-y-1 text-slate-400">
                        @for (item of comanda.items; track $index) {
                          <p class="flex justify-between">
                            <span>{{ item.cantidad }}x {{ item.product.nombre }}</span>
                            <span class="font-mono text-white">{{ item.subtotal | currencyPEN }}</span>
                          </p>
                        }
                        @if (comanda.items.length === 0) {
                          <p class="text-slate-500">La comanda no tiene ítems registrados.</p>
                        }
                      </div>
                      <div class="pt-2 border-t border-white/10 flex justify-between font-bold text-sm text-polleria-gold">
                        <span>Total a Cobrar:</span>
                        <span>{{ comanda.total | currencyPEN }}</span>
                      </div>
                      <div class="flex justify-between text-[11px] text-slate-400">
                        <span>Estado de la comanda:</span>
                        <span class="font-bold" [ngClass]="{
                          'text-amber-400': comanda.estado === 'EN_PREPARACION',
                          'text-emerald-400': comanda.estado === 'LISTO_COCINA'
                        }">{{ etiquetaEstadoComanda(comanda.estado) }}</span>
                      </div>
                    } @else if (cargandoComanda()) {
                      <p class="text-slate-400 text-xs">Cargando comanda del servidor...</p>
                    } @else if (errorComanda()) {
                      <p class="text-rose-400 text-xs">{{ errorComanda() }}</p>
                    } @else {
                      <p class="text-slate-500 text-xs">Sin comanda activa</p>
                    }
                  </div>

                  <!-- Máquina de Estados Operativa de Mesa (Fase 2) -->
                  <div class="space-y-2 pt-2">
                    <span class="text-[11px] font-bold text-slate-400 block">Flujo de Estados de Salón:</span>
                    <div class="grid grid-cols-2 gap-2">
                      <button 
                        (click)="cambiarEstado.emit('OCUPADA')"
                        class="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                      >
                        <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span>Ocupar Mesa</span>
                      </button>
                      <button 
                        (click)="cambiarEstado.emit('POR_COBRAR')"
                        class="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                      >
                        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span>Por Cobrar</span>
                      </button>
                      <button 
                        (click)="cambiarEstado.emit('EN_LIMPIEZA')"
                        class="py-2.5 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                      >
                        <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                        <span>En Limpieza</span>
                      </button>
                      <button 
                        (click)="cambiarEstado.emit('LIBRE')"
                        class="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                      >
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span>Liberar Mesa</span>
                      </button>
                    </div>
                  </div>

                  <!-- Casilla en Cuadrícula de Salón (Solo Admin) -->
                  @if (isAdmin()) {
                    <div class="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                      <span class="text-[11px] font-bold text-slate-400 block">Casilla en Cuadrícula (Columna X, Fila Y):</span>
                      <div class="grid grid-cols-2 gap-2">
                        <div class="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                          <span class="text-[10px] text-slate-400 font-bold">Col X:</span>
                          <input 
                            type="number" 
                            [ngModel]="mesa().posicionX"
                            (ngModelChange)="posicionXChange.emit($event)" 
                            class="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                          />
                        </div>
                        <div class="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                          <span class="text-[10px] text-slate-400 font-bold">Fila Y:</span>
                          <input 
                            type="number" 
                            [ngModel]="mesa().posicionY"
                            (ngModelChange)="posicionYChange.emit($event)" 
                            class="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                          />
                        </div>
                      </div>
                      <button 
                        (click)="guardarPosicion.emit()"
                        class="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg class="w-3.5 h-3.5 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        <span>Guardar Casilla en Cuadrícula</span>
                      </button>
                    </div>
                  }

                  <!-- Servir en mesa: marca persistida; el cobro sigue siendo el que libera la mesa -->
                  @if (comandaMesa()?.estado === 'LISTO_COCINA' && !comandaMesa()?.servidoEn) {
                    <button 
                      (click)="servirMesa.emit()"
                      class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md animate-pulse motion-reduce:animate-none"
                    >
                      Servir en mesa
                    </button>
                  } @else if (comandaMesa()?.servidoEn) {
                    <p class="text-xs font-bold text-emerald-400">Servida en mesa · pendiente de cobro</p>
                  }

                  <!-- Cobro Inmediato -->
                  <div class="pt-2 border-t border-white/10">
                    <button 
                      (click)="cobrar.emit()"
                      class="w-full py-3 rounded-xl bg-polleria-gold hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <span class="flex items-center justify-center gap-1.5"><svg class="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>Cobrar Cuenta & Cerrar Comanda</span>
                    </button>
                  </div>
                </div>
              }

            </div>
  `
})
export class MozoMesaModalComponent {
  readonly mesa = input.required<MesaSalon>();
  readonly comandaMesa = input<Order | null>(null);
  readonly cargandoComanda = input<boolean>(false);
  readonly errorComanda = input<string | null>(null);
  readonly isAdmin = input<boolean>(false);
  readonly ahora = input.required<number>();

  readonly cerrar = output<void>();
  readonly iniciarComanda = output<MesaSalon>();
  readonly cambiarEstado = output<TableStatus>();
  readonly posicionXChange = output<number | undefined>();
  readonly posicionYChange = output<number | undefined>();
  readonly guardarPosicion = output<void>();
  readonly servirMesa = output<void>();
  readonly cobrar = output<void>();

  readonly esMesaParaCobrar = esMesaParaCobrar;
  readonly etiquetaEstadoComanda = etiquetaEstadoComanda;
  readonly horaDe = horaDe;

  tiempoTranscurridoDesde(fechaIso?: string | null): string {
    return tiempoTranscurridoDesde(fechaIso, this.ahora());
  }
}
