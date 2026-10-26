import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MesaSalon } from '../../../../core/models/table.model';
import { ZonaSalonConfig } from '../../../../core/services/salon.service';
import { CasillaDrop, CasillaRef, MesaDragStart, MesaMoveStart } from '../../models/admin-forms';

/** Croquis matricial por zonas. Presentacional: toda acción sale como evento. */
@Component({
  selector: 'app-mesas-croquis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
            <div class="relative bg-[#0d0f14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4">
              
              <!-- Overlay de Espera y Sincronización en la Cuadrícula -->
              @if (isProcesandoMesa() || salonLoading()) {
                <div class="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in shadow-2xl border border-polleria-gold/30">
                  <div class="relative flex items-center justify-center mb-3">
                    <div class="w-16 h-16 rounded-full border-2 border-polleria-gold/20 animate-ping absolute"></div>
                    <svg class="animate-spin w-12 h-12 text-polleria-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                      <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <h4 class="font-display text-base font-bold text-white tracking-wide">
                    {{ isProcesandoMesa() ? mensajeProcesandoMesa() : 'Cargando distribución del salón...' }}
                  </h4>
                  <p class="text-xs text-slate-400 mt-1 max-w-xs">
                    Por favor espere un momento mientras se sincronizan los cambios con el servidor.
                  </p>
                </div>
              }

              <!-- Barra de Navegación por Slides de Zona -->
              <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-white/10">
                <!-- Controles de Slide Anterior / Siguiente -->
                <div class="flex items-center gap-3">
                  <button 
                    type="button"
                    (click)="prevZone.emit()"
                    class="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
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
                    </div>
                    <span class="text-[11px] text-slate-400">
                      Cuadrícula fija de casillas: {{ currentZona().filas }} filas × {{ currentZona().columnas }} columnas
                    </span>
                  </div>

                  <button 
                    type="button"
                    (click)="nextZone.emit()"
                    class="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
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
                      (click)="zoneSelected.emit(idx)"
                      class="px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                      [ngClass]="activeZonaIndex() === idx ? 'bg-polleria-gold text-slate-950 shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'"
                    >
                      <span>{{ z.nombre }}</span>
                    </button>
                  }
                </div>
              </div>

              <!-- Barra de Personalización de Cuadrícula (Filas × Columnas) -->
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#121419] p-3 rounded-xl border border-white/5 text-xs">
                <div class="flex items-center gap-4 flex-wrap">
                  <span class="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Personalizar Cuadrícula:</span>
                  
                  <!-- Ajuste de Filas -->
                  <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                    <span class="text-slate-400">Filas:</span>
                    <button 
                      type="button" 
                      (click)="rowsAdjusted.emit(-1)" 
                      class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                      title="Quitar fila"
                    >-</button>
                    <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().filas }}</span>
                    <button 
                      type="button" 
                      (click)="rowsAdjusted.emit(1)" 
                      class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                      title="Agregar fila"
                    >+</button>
                  </div>

                  <!-- Ajuste de Columnas -->
                  <div class="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                    <span class="text-slate-400">Columnas:</span>
                    <button 
                      type="button" 
                      (click)="columnsAdjusted.emit(-1)" 
                      class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                      title="Quitar columna"
                    >-</button>
                    <span class="font-mono font-bold text-polleria-gold px-1.5">{{ currentZona().columnas }}</span>
                    <button 
                      type="button" 
                      (click)="columnsAdjusted.emit(1)" 
                      class="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center cursor-pointer"
                      title="Agregar columna"
                    >+</button>
                  </div>
                </div>

                <!-- Estado de Movimiento Activo -->
                @if (mesaEnMovimiento(); as mem) {
                  <div class="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 px-3 py-1.5 rounded-xl text-amber-300 animate-pulse">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                    </svg>
                    <span>Moviendo <strong>Mesa #{{ mem.numero }}</strong>: Toca una casilla vacía para ubicarla</span>
                    <button 
                      type="button" 
                      (click)="moveCancelled.emit()" 
                      class="ml-2 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                } @else {
                  <span class="text-[11px] text-slate-400 italic">
                    Toca una casilla vacía para crear una mesa, o arrastra una mesa a otra casilla.
                  </span>
                }
              </div>

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
                          draggable="true"
                          (dragstart)="dragStarted.emit({ event: $event, mesa })"
                          (click)="cellClicked.emit({ row: r, col: c })"
                          class="h-28 rounded-2xl p-2.5 border-2 flex flex-col justify-between items-center transition-all cursor-pointer relative select-none group shadow-lg"
                          [ngClass]="{
                            'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20 hover:scale-[1.02]': mesa.estado === 'LIBRE',
                            'bg-rose-950/80 border-rose-500 text-rose-300 ring-2 ring-rose-500/20 hover:scale-[1.02]': mesa.estado === 'OCUPADA',
                            'bg-amber-950/80 border-amber-500 text-amber-300 ring-4 ring-amber-500/30 animate-pulse': mesa.estado === 'POR_COBRAR',
                            'bg-sky-950/80 border-sky-500 text-sky-300 ring-2 ring-sky-500/20 hover:scale-[1.02]': mesa.estado === 'EN_LIMPIEZA' || mesa.estado === 'LIMPIEZA',
                            'bg-purple-950/80 border-purple-500 text-purple-300 hover:scale-[1.02]': mesa.estado === 'RESERVADA',
                            'animate-pulse motion-reduce:animate-none': mesa.ordenActiva?.estadoOrden === 'LISTO' && !mesa.ordenActiva?.servidoEn,

                            'ring-4 ring-polleria-gold border-polleria-gold scale-[1.03] shadow-polleria-gold/30 z-20': selectedMesa()?.id === mesa.id,
                            'ring-4 ring-amber-400 animate-bounce z-30': mesaEnMovimiento()?.id === mesa.id
                          }"
                        >
                          <!-- Coordenadas Casilla -->
                          <div class="w-full flex justify-between items-center text-[10px]">
                            <span class="font-mono text-slate-400 opacity-60">F{{ r }}:C{{ c }}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-black/40">
                              {{ mesa.capacidad }}p
                            </span>
                          </div>

                          <!-- Número de Mesa Central -->
                          <div class="flex flex-col items-center my-auto">
                            <span class="font-display text-lg font-black text-white tracking-tight leading-none group-hover:text-polleria-gold transition">
                              #{{ mesa.numero }}
                            </span>
                            <span class="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">
                              {{ mesa.estado }}
                            </span>
                            @if (mesa.ordenActiva?.estadoOrden === 'LISTO' && !mesa.ordenActiva?.servidoEn) {
                              <span class="mt-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black uppercase tracking-wider animate-pulse motion-reduce:animate-none">
                                Listo para servir
                              </span>
                            } @else if (mesa.ordenActiva?.servidoEn) {
                              <span class="mt-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black uppercase tracking-wider">
                                Servida
                              </span>
                            }
                          </div>

                          <!-- Footer de Casilla: Total & Botón Mover -->
                          <div class="w-full flex justify-between items-center pt-1 border-t border-white/10 text-[9px]">
                            @if (mesa.ordenActiva) {
                              <span class="font-mono font-bold text-polleria-gold">
                                S/{{ mesa.ordenActiva.total | number:'1.0-0' }}
                              </span>
                            } @else {
                              <span class="text-slate-400">Sin orden</span>
                            }
                            <button 
                              type="button"
                              (click)="moveStarted.emit({ mesa, event: $event })"
                              class="p-1 rounded bg-white/10 hover:bg-polleria-gold hover:text-slate-950 text-slate-300 transition cursor-pointer"
                              title="Reubicar a otra casilla"
                            >
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      } @else {
                        <!-- CASILLA VACÍA -->
                        <div 
                          (click)="cellClicked.emit({ row: r, col: c })"
                          (dragover)="onDragOverCasilla($event)"
                          (drop)="cellDropped.emit({ event: $event, row: r, col: c })"
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
                              <svg class="w-5 h-5 text-slate-500 group-hover:text-polleria-gold transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                              </svg>
                              <span class="text-[10px] font-bold text-slate-400 group-hover:text-white mt-1 transition">
                                + Nueva Mesa
                              </span>
                            }
                          </div>

                          <div class="w-full text-center text-[9px] text-slate-600">
                            Casilla disponible
                          </div>
                        </div>
                      }
                    }
                  }
                </div>
              </div>

            </div>
  `
})
export class MesasCroquisComponent {
  readonly mesas = input.required<MesaSalon[]>();
  readonly zonasSalon = input.required<ZonaSalonConfig[]>();
  readonly currentZona = input.required<ZonaSalonConfig>();
  readonly activeZonaIndex = input.required<number>();
  readonly mesaEnMovimiento = input.required<MesaSalon | null>();
  readonly selectedMesa = input.required<MesaSalon | null>();
  readonly isProcesandoMesa = input.required<boolean>();
  readonly mensajeProcesandoMesa = input.required<string>();
  readonly salonLoading = input.required<boolean>();

  readonly prevZone = output<void>();
  readonly nextZone = output<void>();
  readonly zoneSelected = output<number>();
  readonly rowsAdjusted = output<number>();
  readonly columnsAdjusted = output<number>();
  readonly moveCancelled = output<void>();
  readonly dragStarted = output<MesaDragStart>();
  readonly cellClicked = output<CasillaRef>();
  readonly moveStarted = output<MesaMoveStart>();
  readonly cellDropped = output<CasillaDrop>();

  protected getRowsArray(): number[] {
    return Array.from({ length: this.currentZona().filas }, (_, i) => i + 1);
  }

  protected getColsArray(): number[] {
    return Array.from({ length: this.currentZona().columnas }, (_, i) => i + 1);
  }

  protected getMesaEnCasilla(row: number, col: number): MesaSalon | undefined {
    const zonaId = this.currentZona().id;
    return this.mesas().find(m =>
      (m.zona || 'SALON_PRINCIPAL') === zonaId &&
      Number(m.posicionY) === row &&
      Number(m.posicionX) === col
    );
  }

  protected onDragOverCasilla(event: DragEvent): void {
    event.preventDefault();
  }
}
