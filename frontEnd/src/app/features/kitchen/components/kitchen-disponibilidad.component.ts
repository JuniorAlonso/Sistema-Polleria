import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product, ProductCategory } from '../../../core/models/product.model';

@Component({
  selector: 'app-kitchen-disponibilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <section class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5" aria-label="Gestión de Disponibilidad">
      
      <!-- Barra superior de control y filtros rápidos -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#14161a] border border-white/10 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-extrabold text-white tracking-wide uppercase">
              Control de Platos Agotados
            </h2>
            <p class="text-xs text-slate-400">
              Alterna la disponibilidad en tiempo real para que el salón y los mozos no ofrezcan platos agotados.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            data-testid="btn-recargar-productos"
            (click)="recargar.emit()"
            [disabled]="cargando()"
            class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-200 border border-white/10 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <svg
              class="w-4 h-4 text-amber-400"
              [class.animate-spin]="cargando()"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>{{ cargando() ? 'Actualizando...' : 'Recargar' }}</span>
          </button>
        </div>
      </div>

      <!-- Filtro por categoría y estado -->
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          (click)="categoriaFiltro.set('TODAS')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
          [ngClass]="categoriaFiltro() === 'TODAS' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'"
        >
          Todas ({{ productos().length }})
        </button>

        <button
          type="button"
          data-testid="filtro-solo-agotados"
          (click)="categoriaFiltro.set('AGOTADOS')"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          [ngClass]="categoriaFiltro() === 'AGOTADOS' ? 'bg-rose-500 text-white shadow' : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20'"
        >
          <span class="w-2 h-2 rounded-full bg-rose-400"></span>
          <span>Agotados ({{ productosAgotados().length }})</span>
        </button>

        @for (cat of categoriasDisponibles(); track cat) {
          <button
            type="button"
            (click)="categoriaFiltro.set(cat)"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            [ngClass]="categoriaFiltro() === cat ? 'bg-amber-500 text-slate-950 shadow' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'"
          >
            {{ formatearCategoria(cat) }}
          </button>
        }
      </div>

      <!-- Grid de productos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1">
        @for (prod of productosFiltrados(); track prod.id) {
          <div
            data-testid="tarjeta-producto-cocina"
            [attr.data-producto-id]="prod.id"
            class="rounded-2xl border transition flex flex-col justify-between overflow-hidden shadow-sm"
            [ngClass]="prod.agotado
              ? 'bg-[#181216] border-rose-500/40 shadow-rose-950/20'
              : 'bg-[#14161a] border-white/10 hover:border-white/20'"
          >
            <!-- Cabecera de la tarjeta con imagen y badges -->
            <div class="p-4 space-y-3">
              <div class="flex items-start gap-3">
                @if (prod.imagenUrl) {
                  <img
                    [src]="prod.imagenUrl"
                    [alt]="prod.nombre"
                    class="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0 bg-slate-900"
                    loading="lazy"
                  />
                } @else {
                  <div class="w-14 h-14 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                }

                <div class="flex-1 min-w-0">
                  <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-400 border border-white/5 mb-1 truncate max-w-full">
                    {{ formatearCategoria(prod.categoria) }}
                  </span>
                  <h3 class="text-sm font-bold text-white leading-snug line-clamp-2">
                    {{ prod.nombre }}
                  </h3>
                  <div class="text-xs font-mono font-bold text-amber-400 mt-1">
                    S/ {{ prod.precio | number:'1.2-2' }}
                  </div>
                </div>
              </div>

              <!-- Indicador visual del estado actual -->
              <div class="flex items-center justify-between text-xs pt-1">
                <span class="text-slate-400 font-semibold text-[11px]">Estado actual:</span>
                @if (prod.agotado) {
                  <span
                    data-testid="badge-estado-agotado"
                    class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-extrabold flex items-center gap-1.5"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    AGOTADO
                  </span>
                } @else {
                  <span
                    data-testid="badge-estado-disponible"
                    class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-extrabold flex items-center gap-1.5"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    DISPONIBLE
                  </span>
                }
              </div>
            </div>

            <!-- Botón de acción táctil de alta visibilidad para cocina -->
            <div class="p-3 bg-black/20 border-t border-white/5">
              <button
                type="button"
                data-testid="btn-toggle-disponibilidad"
                (click)="toggleDisponibilidad.emit(prod)"
                [disabled]="estaModificando(prod.id)"
                class="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                [ngClass]="prod.agotado
                  ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/40'
                  : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-rose-950/40'"
              >
                @if (estaModificando(prod.id)) {
                  <svg class="w-4 h-4 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Actualizando...</span>
                } @else if (prod.agotado) {
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Marcar como DISPONIBLE</span>
                } @else {
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                  <span>Marcar como AGOTADO</span>
                }
              </button>
            </div>

          </div>
        } @empty {
          <div class="col-span-full py-16 text-center text-slate-500 bg-[#14161a] rounded-2xl border border-white/10">
            <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
            </div>
            <p class="text-base font-bold text-slate-300">No se encontraron productos en esta categoría</p>
            <p class="text-xs text-slate-500 mt-1">Selecciona otra categoría o pulsa Recargar para sincronizar con la carta.</p>
          </div>
        }
      </div>

    </section>
  `
})
export class KitchenDisponibilidadComponent {
  readonly productos = input.required<Product[]>();
  readonly cargando = input<boolean>(false);
  readonly modificandoIds = input<Set<string>>(new Set());

  readonly toggleDisponibilidad = output<Product>();
  readonly recargar = output<void>();

  readonly categoriaFiltro = signal<string>('TODAS');

  readonly productosAgotados = () => this.productos().filter(p => p.agotado);

  readonly categoriasDisponibles = () => {
    const set = new Set<ProductCategory>();
    for (const p of this.productos()) {
      if (p.categoria) {
        set.add(p.categoria);
      }
    }
    return Array.from(set).sort();
  };

  readonly productosFiltrados = () => {
    const f = this.categoriaFiltro();
    const list = this.productos();
    if (f === 'TODAS') {
      return list;
    }
    if (f === 'AGOTADOS') {
      return list.filter(p => p.agotado);
    }
    return list.filter(p => p.categoria === f);
  };

  estaModificando(id: string): boolean {
    return this.modificandoIds().has(String(id));
  }

  formatearCategoria(cat: string): string {
    return cat ? cat.replace(/_/g, ' ') : 'General';
  }
}

