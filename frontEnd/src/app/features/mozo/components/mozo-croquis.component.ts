import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyPENPipe } from '../../../shared/pipes/currency-pen.pipe';
import { ZonaSalonConfig } from '../../../core/services/salon.service';
import { MesaSalon } from '../mozo.types';
import { esMesaParaCobrar, tiempoTranscurridoDesde } from '../mozo.helpers';

@Component({
  selector: 'app-mozo-croquis',
  standalone: true,
  imports: [CommonModule, CurrencyPENPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block relative bg-[#0d0f14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4' },
  template: `
                
                <!-- Banner de Error de Conexión con Backend -->
                @if (hasError()) {
                  <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <span class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <span>Sin conexión con el servidor para sincronizar mesas.</span>
                    </span>
                    <button type="button" (click)="reintentar.emit()" class="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-white font-bold transition text-[11px] cursor-pointer">Reintentar</button>
                  </div>
                }

                <!-- Overlay de Espera y Sincronización en la Cuadrícula -->
                @if (isProcesandoMesa() || isLoading()) {
                  <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in shadow-2xl border border-polleria-gold/30">
                    <div class="relative flex items-center justify-center mb-3">
                      <div class="w-16 h-16 rounded-full border-2 border-polleria-gold/20 animate-ping absolute"></div>
                      <svg class="animate-spin w-12 h-12 text-polleria-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <h4 class="font-display text-base font-bold text-white tracking-wide">
                      {{ isProcesandoMesa() ? mensajeProcesandoMesa() : 'Cargando mesas del salón...' }}
                    </h4>
                    <p class="text-xs text-slate-400 mt-1 max-w-xs">
                      Por favor espere un momento mientras se completa la sincronización con el servidor.
                    </p>
                  </div>
                }

                <!-- Barra de Navegación por Slides de Zona -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/10">
                  <!-- Controles de Slide Anterior / Siguiente -->
                  <div class="flex items-center gap-3">
                    <button 
                      type="button"
                      (click)="prevZona.emit()"
                      class="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title="Ver zona anterior"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                      <span class="hidden sm:inline">Anterior</span>
                    </button>

                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="font-display text-lg sm:text-xl font-black text-white tracking-wide">
                          {{ currentZona().nombre }}
                        </span>
                        <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-polleria-gold/20 text-polleria-gold border border-polleria-gold/30">
                          Slide {{ activeZonaIndex() + 1 }} de {{ zonasSalon().length }}
                        </span>
                      </div>
                      <span class="text-[11px] text-slate-400">
                        Cuadrícula de casillas: {{ currentZona().filas }} filas × {{ currentZona().columnas }} columnas
                      </span>
                    </div>

                    <button 
                      type="button"
                      (click)="nextZona.emit()"
                      class="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      title="Ver siguiente zona"
                    >
                      <span class="hidden sm:inline">Siguiente</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>

                  <!-- Píldoras de Salto Directo a Zona -->
                  <div class="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                    @for (z of zonasSalon(); track z.id; let idx = $index) {
                      <button 
                        type="button"
                        (click)="zonaSelect.emit(idx)"
                        class="px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                        [ngClass]="activeZonaIndex() === idx ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'"
                      >
                        <span>{{ z.nombre }}</span>
                      </button>
                    }
                  </div>
                </div>

                <!-- Barra de Personalización de Cuadrícula (Filas × Columnas) & Leyenda -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#121419] p-3 rounded-xl border border-white/5 text-xs">
                  @if (isAdmin()) {
                    <div class="flex items-center gap-4 flex-wrap">
                      <span class="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Personalizar Cuadrícula:</span>
                      
                      <!-- Ajuste de Filas -->
                      <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                        <span class="text-slate-400">Filas:</span>
                        <button 
                          type="button" 
                          (click)="ajustarFilas.emit(-1)" 
                          class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                          title="Quitar fila"
                        >-</button>
                        <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().filas }}</span>
                        <button 
                          type="button" 
                          (click)="ajustarFilas.emit(1)" 
                          class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                          title="Agregar fila"
                        >+</button>
                      </div>

                      <!-- Ajuste de Columnas -->
                      <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                        <span class="text-slate-400">Columnas:</span>
                        <button 
                          type="button" 
                          (click)="ajustarColumnas.emit(-1)" 
                          class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                          title="Quitar columna"
                        >-</button>
                        <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().columnas }}</span>
                        <button 
                          type="button" 
                          (click)="ajustarColumnas.emit(1)" 
                          class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                          title="Agregar columna"
                        >+</button>
                      </div>
                    </div>
                  } @else {
                    <div class="flex items-center gap-2 text-slate-400 text-[11px]">
                      <svg class="w-4 h-4 text-polleria-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span>Toca una mesa verde para iniciar comanda, o amarilla para cobrar y cerrar comanda.</span>
                    </div>
                  }

                  <!-- Leyenda de Estados para el Mozo -->
                  <div class="flex items-center gap-3 text-[11px] flex-wrap">
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Libre</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Ocupada (Cocina)</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30"></span> Servida / Cobrar</span>
                    <span class="flex items-center gap-1 text-slate-400"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Limpieza</span>
                  </div>
                </div>

                <!-- Estado de Movimiento Activo -->
                @if (mesaEnMovimiento(); as mem) {
                  <div class="flex items-center justify-between bg-amber-500/15 border border-amber-500/40 px-3 py-2 rounded-xl text-amber-300 text-xs animate-pulse">
                    <div class="flex items-center gap-2">
                      <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                      </svg>
                      <span>Moviendo <strong>{{ mem.nombre }}</strong>: Toca una casilla vacía para reubicarla</span>
                    </div>
                    <button 
                      type="button" 
                      (click)="cancelarMovimiento.emit()" 
                      class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                }

                <!-- Lienzo de la Cuadrícula Matricial -->
                <div class="overflow-x-auto pb-4 select-none">
                  <div 
                    class="grid gap-3 p-4 bg-[#0a0c10] border border-white/10 rounded-2xl min-w-max mx-auto shadow-inner"
                    [style.gridTemplateColumns]="'repeat(' + currentZona().columnas + ', minmax(110px, 1fr))'"
                  >
                    @for (r of getRowsArray(); track r) {
                      @for (c of getColsArray(); track c) {
                        @if (getMesaEnCasilla(r, c); as mesa) {
                          <!-- CASILLA OCUPADA POR MESA -->
                          <div 
                            [attr.draggable]="isAdmin() ? true : null"
                            (dragstart)="isAdmin() ? dragStartMesa.emit({ event: $event, mesa }) : null"
                            (click)="casillaClick.emit({ row: r, col: c })"
                            class="h-28 rounded-2xl p-2.5 border-2 flex flex-col justify-between items-center transition-all cursor-pointer relative select-none group shadow-lg"
                            [ngClass]="{
                              'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20 hover:scale-[1.02]': mesa.estado === 'LIBRE',
                              'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 hover:scale-[1.02] shadow-amber-500/10': esMesaParaCobrar(mesa),
                              'bg-rose-950/80 border-rose-500 text-rose-300 ring-2 ring-rose-500/20 hover:scale-[1.02]': !esMesaParaCobrar(mesa) && mesa.estado === 'OCUPADA',
                              'bg-sky-950/80 border-sky-500 text-sky-300 ring-2 ring-sky-500/20 hover:scale-[1.02]': mesa.estado === 'EN_LIMPIEZA' || mesa.estado === 'LIMPIEZA',
                              'bg-purple-950/80 border-purple-500 text-purple-300 hover:scale-[1.02]': mesa.estado === 'RESERVADA',

                              'ring-4 ring-polleria-gold border-polleria-gold scale-[1.03] shadow-polleria-gold/30 z-20': selectedMesaId() === mesa.id,
                              'ring-4 ring-amber-400 animate-bounce z-30': mesaEnMovimiento()?.id === mesa.id,
                              'ring-4 ring-amber-400/70 animate-pulse motion-reduce:animate-none': mesa.platosListos
                            }"
                          >
                            <!-- Badge Alerta Plato Listo -->
                            @if (mesa.platosListos) {
                              <span class="absolute -top-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-bounce shadow border border-white/20 whitespace-nowrap z-30">
                                ¡Plato Listo!
                              </span>
                            }

                            <!-- Coordenadas Casilla & Capacidad -->
                            <div class="w-full flex justify-between items-center text-[10px]">
                              <span class="font-mono text-slate-400 opacity-60">F{{ r }}:C{{ c }}</span>
                              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/40">
                                {{ mesa.capacidad }}p
                              </span>
                            </div>

                            <!-- Nombre/Número de Mesa Central + Estado + Contador Servido -->
                            <div class="flex flex-col items-center my-auto">
                              <span class="font-display text-base font-black text-white tracking-tight leading-none group-hover:text-polleria-gold transition">
                                {{ mesa.nombre }}
                              </span>
                              <span class="text-[9px] font-bold uppercase tracking-wider mt-0.5"
                                [ngClass]="esMesaParaCobrar(mesa) ? 'text-amber-300' : 'opacity-80'">
                                {{ esMesaParaCobrar(mesa) ? 'POR COBRAR' : mesa.estado }}
                              </span>

                              <!-- Contador de tiempo desde que se sirvió -->
                              @if (mesa.servidoEn) {
                                <div class="flex items-center gap-1 font-mono text-[9px] text-amber-300 bg-amber-900/70 border border-amber-500/40 px-1.5 py-0.5 rounded-md mt-1 shadow-xs" title="Tiempo transcurrido desde que se sirvió la comida">
                                  <svg class="w-2.5 h-2.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                  </svg>
                                  <span>{{ tiempoTranscurridoDesde(mesa.servidoEn) }}</span>
                                </div>
                              }
                            </div>

                            <!-- Footer de Casilla: Total Consumo & Botón Reubicar (Solo Admin) -->
                            <div class="w-full flex justify-between items-center pt-1 border-t border-white/10 text-[9px]">
                              @if (mesa.totalConsumo && mesa.totalConsumo > 0) {
                                <span class="font-mono font-bold text-polleria-gold">
                                  {{ mesa.totalConsumo | currencyPEN }}
                                </span>
                              } @else {
                                <span class="text-slate-400">Sin orden</span>
                              }
                              @if (isAdmin()) {
                                <button 
                                  type="button"
                                  (click)="moverMesa.emit({ mesa, event: $event })"
                                  class="p-1 rounded bg-white/10 hover:bg-polleria-gold hover:text-slate-950 text-slate-300 transition cursor-pointer"
                                  title="Reubicar a otra casilla"
                                >
                                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                                  </svg>
                                </button>
                              }
                            </div>
                          </div>
                        } @else {
                          <!-- CASILLA VACÍA -->
                          <div 
                            (click)="casillaClick.emit({ row: r, col: c })"
                            (dragover)="isAdmin() ? dragOverCasilla.emit($event) : null"
                            (drop)="isAdmin() ? dropCasilla.emit({ event: $event, row: r, col: c }) : null"
                            class="h-28 rounded-2xl border-2 border-dashed transition-all flex flex-col justify-between items-center p-2.5 cursor-pointer group"
                            [ngClass]="mesaEnMovimiento() ? 'border-polleria-gold/50 bg-polleria-gold/10 hover:border-polleria-gold hover:bg-polleria-gold/20' : 'border-white/10 bg-[#0d0e12] hover:border-white/30 hover:bg-white/5'"
                          >
                            <div class="w-full flex justify-between items-center text-[10px] text-slate-500">
                              <span class="font-mono">F{{ r }}:C{{ c }}</span>
                              <span class="text-[9px] opacity-0 group-hover:opacity-100 text-slate-400 transition">Vacía</span>
                            </div>

                            <div class="flex flex-col items-center justify-center my-auto transition-transform group-hover:scale-110">
                              @if (mesaEnMovimiento()) {
                                <span class="text-xs font-bold text-polleria-gold flex items-center gap-1">
                                  <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                                  </svg>
                                  <span>Ubicar aquí</span>
                                </span>
                              } @else {
                                <span class="w-6 h-6 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-600 group-hover:border-slate-500 group-hover:text-slate-400 transition">
                                  <span class="text-[10px]">•</span>
                                </span>
                                <span class="text-[10px] text-slate-600 group-hover:text-slate-400 mt-1 transition">
                                  Disponible
                                </span>
                              }
                            </div>

                            <div class="w-full text-center text-[9px] text-slate-600">
                              Espacio libre
                            </div>
                          </div>
                        }
                      }
                    }
                  </div>
                </div>

  `
})
export class MozoCroquisComponent {
  readonly zonasSalon = input.required<ZonaSalonConfig[]>();
  readonly currentZona = input.required<ZonaSalonConfig>();
  readonly activeZonaIndex = input.required<number>();
  readonly mesas = input.required<MesaSalon[]>();
  readonly hasError = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly isProcesandoMesa = input<boolean>(false);
  readonly mensajeProcesandoMesa = input<string>('');
  readonly isAdmin = input<boolean>(false);
  readonly mesaEnMovimiento = input<MesaSalon | null>(null);
  readonly selectedMesaId = input<number | null | undefined>(null);
  readonly ahora = input.required<number>();

  readonly reintentar = output<void>();
  readonly prevZona = output<void>();
  readonly nextZona = output<void>();
  readonly zonaSelect = output<number>();
  readonly ajustarFilas = output<number>();
  readonly ajustarColumnas = output<number>();
  readonly cancelarMovimiento = output<void>();
  readonly casillaClick = output<{ row: number; col: number }>();
  readonly dragStartMesa = output<{ event: DragEvent; mesa: MesaSalon }>();
  readonly dragOverCasilla = output<DragEvent>();
  readonly dropCasilla = output<{ event: DragEvent; row: number; col: number }>();
  readonly moverMesa = output<{ mesa: MesaSalon; event: Event }>();

  readonly esMesaParaCobrar = esMesaParaCobrar;

  tiempoTranscurridoDesde(fechaIso?: string | null): string {
    return tiempoTranscurridoDesde(fechaIso, this.ahora());
  }

  getRowsArray(): number[] {
    return Array.from({ length: this.currentZona().filas }, (_, i) => i + 1);
  }

  getColsArray(): number[] {
    return Array.from({ length: this.currentZona().columnas }, (_, i) => i + 1);
  }

  getMesaEnCasilla(row: number, col: number): MesaSalon | undefined {
    const zonaId = this.currentZona().id;
    return this.mesas().find(m =>
      (m.zona || 'SALON_PRINCIPAL') === zonaId &&
      Number(m.posicionY) === row &&
      Number(m.posicionX) === col
    );
  }
}
