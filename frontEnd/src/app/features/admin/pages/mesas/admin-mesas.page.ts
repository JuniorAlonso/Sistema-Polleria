import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { SalonService, ZonaSalonConfig } from '../../../../core/services/salon.service';
import { OrdersService } from '../../../../core/services/orders.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProductsService } from '../../../../core/services/products.service';
import { MesaSalon, MesaEstado, SalonZona } from '../../../../core/models/table.model';
import { AdminShellStore } from '../../state/admin-shell.store';
import { MesasSummaryComponent } from '../../components/mesas/mesas-summary.component';
import { MesasViewToolbarComponent } from '../../components/mesas/mesas-view-toolbar.component';
import { MesasCroquisComponent } from '../../components/mesas/mesas-croquis.component';
import { MesasCardsComponent } from '../../components/mesas/mesas-cards.component';
import { MesaInspectorComponent } from '../../components/mesas/mesa-inspector.component';
import { MesaCoordinatesModalComponent } from '../../components/mesas/mesa-coordinates-modal.component';
import { MesaCreateModalComponent } from '../../components/mesas/mesa-create-modal.component';
import { MesaEditModalComponent } from '../../components/mesas/mesa-edit-modal.component';

/**
 * Contenedor (smart) de la pestaña MESAS & SALÓN: CRUD de mesas, croquis por zonas y cobro de
 * comandas. La toma de comanda / segunda ronda se delega al store compartido (modal de orden manual).
 */
@Component({
  selector: 'app-admin-mesas-page',
  standalone: true,
  imports: [
    CommonModule,
    MesasSummaryComponent,
    MesasViewToolbarComponent,
    MesasCroquisComponent,
    MesasCardsComponent,
    MesaInspectorComponent,
    MesaCoordinatesModalComponent,
    MesaCreateModalComponent,
    MesaEditModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

          <!-- Header Bar with Add Table Button -->
          <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#14161a] p-5 rounded-2xl border border-white/10 shadow-lg">
            <div>
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <svg class="w-6 h-6 text-polleria-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span>Gestión de Salón & Mesas</span>
                <span class="text-[11px] font-bold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                  Modo Admin (CRUD)
                </span>
              </h2>
              <p class="text-xs text-slate-400">Control maestro de capacidad física, zonas del restaurante y coordenadas en plano espacial.</p>
            </div>
          </div>

      <app-mesas-summary
        [total]="salonService.mesas().length"
        [libres]="salonService.mesasLibres().length"
        [ocupadas]="salonService.mesasOcupadas().length"
        [porCobrar]="salonService.mesasPorCobrar().length"
        [enLimpieza]="salonService.mesasEnLimpieza().length"
      />

      <app-mesas-view-toolbar
        [mesaViewMode]="mesaViewMode()"
        (viewModeChange)="mesaViewMode.set($event)"
        (autoOrganize)="autoOrganizarCuadricula()"
        (createTable)="abrirCrearMesaModal()"
      />

      @if (mesaViewMode() === 'CROQUIS') {
        <app-mesas-croquis
          [mesas]="salonService.mesas()"
          [zonasSalon]="zonasSalon"
          [currentZona]="currentZona()"
          [activeZonaIndex]="activeZonaIndex()"
          [mesaEnMovimiento]="mesaEnMovimiento()"
          [selectedMesa]="selectedMesa()"
          [isProcesandoMesa]="isProcesandoMesa()"
          [mensajeProcesandoMesa]="mensajeProcesandoMesa()"
          [salonLoading]="salonService.isLoading()"
          (prevZone)="prevZona()"
          (nextZone)="nextZona()"
          (zoneSelected)="setZonaIndex($event)"
          (rowsAdjusted)="ajustarFilas($event)"
          (columnsAdjusted)="ajustarColumnas($event)"
          (moveCancelled)="mesaEnMovimiento.set(null)"
          (dragStarted)="onDragStartMesa($event.event, $event.mesa)"
          (cellClicked)="onCasillaClick($event.row, $event.col)"
          (moveStarted)="iniciarMoverMesa($event.mesa, $event.event)"
          (cellDropped)="onDropCasilla($event.event, $event.row, $event.col)"
        />
      } @else {
        <app-mesas-cards
          [mesas]="salonService.mesas()"
          [selectedMesa]="selectedMesa()"
          (mesaSelected)="selectedMesa.set($event)"
          (editRequested)="abrirEditarMesaModal($event)"
          (coordinatesRequested)="abrirEditarCoordenadas($event)"
          (deactivateRequested)="darDeBajaMesa($event)"
        />
      }

      <!-- Panel Inspector Administrativo de Mesa -->
      @if (selectedMesa(); as mesa) {
        <app-mesa-inspector
          [mesa]="mesa"
          (addDishes)="store.abrirAgregarPlatosMesa($event)"
          (charge)="cobrarComandaMesa($event)"
          (takeOrder)="store.abrirTomarComandaMesa($event)"
          (edit)="abrirEditarMesaModal($event)"
          (deactivate)="darDeBajaMesa($event)"
        />
      }

    </main>

    <!-- Modal: editar coordenadas en el plano -->
    @if (showEditarCoordenadasModal && mesaEditarCoordenadas; as mesaCoordenadas) {
      <app-mesa-coordinates-modal
        [mesa]="mesaCoordenadas"
        [initial]="{ x: coordX, y: coordY }"
        [isProcesandoMesa]="isProcesandoMesa()"
        (closed)="showEditarCoordenadasModal = false"
        (saved)="coordX = $event.x; coordY = $event.y; guardarCoordenadasMesa()"
      />
    }

    <!-- Modal: crear mesa -->
    @if (showCrearMesaModal) {
      <app-mesa-create-modal
        [initial]="crearMesaForm"
        [zonasSalon]="zonasSalon"
        [isProcesandoMesa]="isProcesandoMesa()"
        (closed)="showCrearMesaModal = false"
        (saved)="crearMesaForm = $event; guardarCrearMesa()"
      />
    }

    <!-- Modal: editar mesa -->
    @if (showEditarMesaModal) {
      <app-mesa-edit-modal
        [initial]="editarMesaForm"
        [zonasSalon]="zonasSalon"
        [isProcesandoMesa]="isProcesandoMesa()"
        (closed)="showEditarMesaModal = false"
        (saved)="editarMesaForm = $event; guardarEditarMesa()"
      />
    }
  `
})
export class AdminMesasPage {
  readonly salonService = inject(SalonService);
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly notify = inject(NotificationService);
  readonly store = inject(AdminShellStore);

  // Modal de Editar Coordenadas de Mesa (Fase 2)
  showEditarCoordenadasModal = false;
  mesaEditarCoordenadas: MesaSalon | null = null;

  // Modales de Gestión de Mesas CRUD (Fase 2)
  showCrearMesaModal = false;
  crearMesaForm = {
    numero: 1,
    capacidad: 4,
    zona: 'SALON_PRINCIPAL' as SalonZona,
    posicionX: 0,
    posicionY: 0
  };

  showEditarMesaModal = false;
  editarMesaForm = {
    id: 0 as string | number,
    numero: 1,
    capacidad: 4,
    zona: 'SALON_PRINCIPAL' as SalonZona,
    posicionX: 0,
    posicionY: 0,
    activo: true
  };

  coordX = 0;
  coordY = 0;

  // Croquis Virtual por Zonas (Slides) & Cuadrícula Personalizable
  readonly mesaViewMode = signal<'CROQUIS' | 'CARDS'>('CROQUIS');

  get zonasSalon(): ZonaSalonConfig[] {
    return this.salonService.zonasSalon();
  }

  readonly activeZonaIndex = signal<number>(0);
  readonly currentZona = computed(() => this.salonService.zonasSalon()[this.activeZonaIndex()] || this.salonService.zonasSalon()[0]);
  readonly mesaEnMovimiento = signal<MesaSalon | null>(null);

  // Estado de Carga y Espera para Procesos de Salón/Mesas (Spinner interactivo)
  readonly isProcesandoMesa = signal<boolean>(false);
  readonly mensajeProcesandoMesa = signal<string>('Sincronizando con el servidor...');

  // Mesa seleccionada para detalle
  readonly selectedMesa = signal<MesaSalon | null>(null);

  /** Cobro de una comanda de salón: cierra la orden y el backend libera la mesa. */
  cobrarComandaMesa(mesa: MesaSalon): void {
    const orden = mesa.ordenActiva;
    if (!orden) {
      this.notify.showWarning('La mesa no tiene una comanda activa');
      return;
    }
    if (orden.estadoOrden !== 'LISTO') {
      this.notify.showWarning(
        'La comanda todavía no está lista',
        `Cocina debe marcarla LISTO antes de cobrar (estado actual: ${orden.estadoOrden}).`
      );
      return;
    }

    this.ordersService.updateOrderStatus(String(orden.ordenId), 'COMPLETADO').subscribe({
      next: () => {
        this.store.recargarSalonYOrdenes();
        this.selectedMesa.set(null);
        this.notify.showSuccess(`Comanda #${orden.ordenId} cobrada; la mesa quedó libre`);
      },
      error: (err) => {
        const motivo = err?.error?.error || err?.error?.message || err?.message
          || 'El backend rechazó el cierre de la comanda';
        this.notify.showError('No se pudo cobrar la comanda', motivo);
      }
    });
  }

  // ================= MÉTODOS CRUD DE MESAS (FASE 2 - ADMIN) =================

  abrirCrearMesaModal(): void {
    const existing = this.salonService.mesas();
    const nextNum = existing.length > 0 ? Math.max(...existing.map(m => Number(m.numero || 0))) + 1 : 1;
    this.crearMesaForm = {
      numero: nextNum,
      capacidad: 4,
      zona: 'SALON_PRINCIPAL',
      posicionX: 0,
      posicionY: 0
    };
    this.showCrearMesaModal = true;
  }

  guardarCrearMesa(): void {
    if (this.crearMesaForm.numero <= 0 || this.crearMesaForm.capacidad <= 0) {
      this.notify.showWarning('El número de mesa y la capacidad deben ser mayores a 0');
      return;
    }
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Creando y registrando Mesa #${this.crearMesaForm.numero}...`);
    this.salonService.crearMesa({
      numero: this.crearMesaForm.numero,
      capacidad: this.crearMesaForm.capacidad,
      zona: this.crearMesaForm.zona,
      posicionX: this.crearMesaForm.posicionX,
      posicionY: this.crearMesaForm.posicionY
    }).subscribe({
      next: (m) => {
        this.isProcesandoMesa.set(false);
        this.showCrearMesaModal = false;
        this.notify.showSuccess(`Mesa #${m.numero} registrada exitosamente`);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al crear la mesa');
      }
    });
  }

  abrirEditarMesaModal(mesa: MesaSalon): void {
    this.editarMesaForm = {
      id: mesa.id,
      numero: mesa.numero || 1,
      capacidad: mesa.capacidad || 4,
      zona: (mesa.zona || 'SALON_PRINCIPAL') as SalonZona,
      posicionX: mesa.posicionX || 0,
      posicionY: mesa.posicionY || 0,
      activo: mesa.activo !== undefined ? mesa.activo : true
    };
    this.showEditarMesaModal = true;
  }

  guardarEditarMesa(): void {
    if (this.editarMesaForm.numero <= 0 || this.editarMesaForm.capacidad <= 0) {
      this.notify.showWarning('El número y la capacidad deben ser válidos');
      return;
    }
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Guardando cambios de Mesa #${this.editarMesaForm.numero}...`);
    this.salonService.actualizarMesa(this.editarMesaForm.id, {
      numero: this.editarMesaForm.numero,
      capacidad: this.editarMesaForm.capacidad,
      zona: this.editarMesaForm.zona,
      posicionX: this.editarMesaForm.posicionX,
      posicionY: this.editarMesaForm.posicionY,
      activo: this.editarMesaForm.activo
    }).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.showEditarMesaModal = false;
        this.notify.showSuccess(`Mesa #${this.editarMesaForm.numero} actualizada exitosamente`);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al actualizar mesa');
      }
    });
  }

  darDeBajaMesa(mesa: MesaSalon): void {
    if (confirm(`¿Estás seguro de dar de baja la Mesa #${mesa.numero}? Se preservará el histórico contable.`)) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Dando de baja Mesa #${mesa.numero}...`);
      this.salonService.eliminarMesa(mesa.id).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          if (this.selectedMesa()?.id === mesa.id) {
            this.selectedMesa.set(null);
          }
        },
        error: (err) => {
          this.isProcesandoMesa.set(false);
          this.notify.showError(err?.error?.message || 'No se pudo dar de baja la mesa');
        }
      });
    }
  }

  abrirEditarCoordenadas(mesa: MesaSalon): void {
    this.mesaEditarCoordenadas = mesa;
    this.coordX = mesa.posicionX || 0;
    this.coordY = mesa.posicionY || 0;
    this.showEditarCoordenadasModal = true;
  }

  guardarCoordenadasMesa(): void {
    if (!this.mesaEditarCoordenadas) return;
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Guardando coordenadas de Mesa #${this.mesaEditarCoordenadas.numero}...`);
    this.salonService.actualizarPosicionMesa(this.mesaEditarCoordenadas.id, this.coordX, this.coordY).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`Posición de ${this.mesaEditarCoordenadas?.nombre} actualizada a (${this.coordX}, ${this.coordY})`);
        this.showEditarCoordenadasModal = false;
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError('No se pudo guardar la posición de la mesa');
      }
    });
  }

  cambiarEstadoMesaDirecto(mesa: MesaSalon, nuevoEstado: MesaEstado): void {
    // El backend rechaza LIBRE/EN_LIMPIEZA con comanda activa (409). En la UI se avisa antes
    // de disparar la petición, igual que en la ventana del mozo.
    if ((nuevoEstado === 'LIBRE' || nuevoEstado === 'EN_LIMPIEZA') && mesa.ordenActiva) {
      this.notify.showWarning(
        'Comanda activa',
        `Cobrá o cancelá la comanda #${mesa.ordenActiva.ordenId} antes de pasar la mesa a ${nuevoEstado}.`
      );
      return;
    }

    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Actualizando estado de Mesa #${mesa.numero} a ${nuevoEstado}...`);
    this.salonService.actualizarEstadoMesa(mesa.id, nuevoEstado).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`${mesa.nombre} cambiada a ${nuevoEstado}`);
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(`No se pudo cambiar ${mesa.nombre} a ${nuevoEstado}`);
      }
    });
  }

  toggleEstadoMesa(m: MesaSalon): void {
    let siguiente: MesaEstado = 'LIBRE';
    if (m.estado === 'LIBRE') siguiente = 'OCUPADA';
    else if (m.estado === 'OCUPADA') siguiente = 'POR_COBRAR';
    else if (m.estado === 'POR_COBRAR') siguiente = 'EN_LIMPIEZA';
    else siguiente = 'LIBRE';

    this.cambiarEstadoMesaDirecto(m, siguiente);
  }

  // ================= CROQUIS POR ZONAS (SLIDES) & CUADRÍCULA MATRICIAL =================

  prevZona(): void {
    const idx = this.activeZonaIndex();
    this.activeZonaIndex.set(idx > 0 ? idx - 1 : this.zonasSalon.length - 1);
    this.mesaEnMovimiento.set(null);
  }

  nextZona(): void {
    const idx = this.activeZonaIndex();
    this.activeZonaIndex.set(idx < this.zonasSalon.length - 1 ? idx + 1 : 0);
    this.mesaEnMovimiento.set(null);
  }

  setZonaIndex(idx: number): void {
    this.activeZonaIndex.set(idx);
    this.mesaEnMovimiento.set(null);
  }

  ajustarFilas(delta: number): void {
    const z = this.currentZona();
    if (z) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Ajustando cuadrícula de ${z.nombre}...`);
      this.salonService.ajustarDimensionesZona(z.id, delta, 0);
      setTimeout(() => this.isProcesandoMesa.set(false), 250);
    }
  }

  ajustarColumnas(delta: number): void {
    const z = this.currentZona();
    if (z) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Ajustando cuadrícula de ${z.nombre}...`);
      this.salonService.ajustarDimensionesZona(z.id, 0, delta);
      setTimeout(() => this.isProcesandoMesa.set(false), 250);
    }
  }

  getRowsArray(): number[] {
    return Array.from({ length: this.currentZona().filas }, (_, i) => i + 1);
  }

  getColsArray(): number[] {
    return Array.from({ length: this.currentZona().columnas }, (_, i) => i + 1);
  }

  getMesaEnCasilla(row: number, col: number): MesaSalon | undefined {
    const zonaId = this.currentZona().id;
    return this.salonService.mesas().find(m => 
      (m.zona || 'SALON_PRINCIPAL') === zonaId &&
      Number(m.posicionY) === row &&
      Number(m.posicionX) === col
    );
  }

  iniciarMoverMesa(mesa: MesaSalon, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.mesaEnMovimiento()?.id === mesa.id) {
      this.mesaEnMovimiento.set(null);
    } else {
      this.mesaEnMovimiento.set(mesa);
      this.selectedMesa.set(mesa);
      this.notify.showInfo(`Mesa #${mesa.numero} en modo mover. Haz clic en una casilla vacía.`);
    }
  }

  onCasillaClick(row: number, col: number): void {
    const mesaExistente = this.getMesaEnCasilla(row, col);
    if (mesaExistente) {
      if (this.mesaEnMovimiento() && this.mesaEnMovimiento()?.id !== mesaExistente.id) {
        this.notify.showWarning(`La casilla (${col}, ${row}) ya está ocupada por la Mesa #${mesaExistente.numero}`);
      } else {
        this.selectedMesa.set(mesaExistente);
      }
      return;
    }

    const enMovimiento = this.mesaEnMovimiento();
    if (enMovimiento) {
      const zonaActual = this.currentZona().id;
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando Mesa #${enMovimiento.numero} a F${row}:C${col}...`);
      this.salonService.actualizarMesa(enMovimiento.id, {
        posicionX: col,
        posicionY: row,
        zona: zonaActual
      }).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          enMovimiento.posicionX = col;
          enMovimiento.posicionY = row;
          enMovimiento.zona = zonaActual;
          this.notify.showSuccess(`Mesa #${enMovimiento.numero} reubicada en (${col}, ${row}) de ${this.currentZona().nombre}`);
          this.mesaEnMovimiento.set(null);
        },
        error: (err) => {
          this.isProcesandoMesa.set(false);
          this.notify.showError(err?.error?.message || 'Error al reubicar mesa');
        }
      });
      return;
    }

    // Casilla vacía: crear nueva mesa
    const existing = this.salonService.mesas();
    const nextNum = existing.length > 0 ? Math.max(...existing.map(m => Number(m.numero || 0))) + 1 : 1;
    this.crearMesaForm = {
      numero: nextNum,
      capacidad: 4,
      zona: this.currentZona().id,
      posicionX: col,
      posicionY: row
    };
    this.showCrearMesaModal = true;
  }

  onDragStartMesa(event: DragEvent, mesa: MesaSalon): void {
    event.dataTransfer?.setData('text/plain', String(mesa.id));
    this.mesaEnMovimiento.set(mesa);
    this.selectedMesa.set(mesa);
  }

  onDragOverCasilla(event: DragEvent): void {
    event.preventDefault();
  }

  onDropCasilla(event: DragEvent, row: number, col: number): void {
    event.preventDefault();
    const mesaId = event.dataTransfer?.getData('text/plain');
    if (!mesaId) return;

    if (this.getMesaEnCasilla(row, col)) {
      this.notify.showWarning('Esa casilla ya está ocupada');
      return;
    }

    const mesa = this.salonService.mesas().find(m => String(m.id) === String(mesaId));
    if (!mesa) return;

    const zonaActual = this.currentZona().id;
    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Reubicando Mesa #${mesa.numero} a F${row}:C${col}...`);
    this.salonService.actualizarMesa(mesa.id, {
      posicionX: col,
      posicionY: row,
      zona: zonaActual
    }).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        mesa.posicionX = col;
        mesa.posicionY = row;
        mesa.zona = zonaActual;
        this.notify.showSuccess(`Mesa #${mesa.numero} movida a Casilla (${col}, ${row})`);
        this.mesaEnMovimiento.set(null);
      },
      error: (err) => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(err?.error?.message || 'Error al mover mesa');
      }
    });
  }

  autoOrganizarCuadricula(): void {
    const zonaActual = this.currentZona();
    const mesasZona = this.salonService.mesas()
      .filter(m => (m.zona || 'SALON_PRINCIPAL') === zonaActual.id)
      .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

    if (mesasZona.length === 0) {
      this.notify.showInfo(`No hay mesas registradas en ${zonaActual.nombre}`);
      return;
    }

    this.isProcesandoMesa.set(true);
    this.mensajeProcesandoMesa.set(`Organizando mesas en cuadrícula de ${zonaActual.nombre}...`);

    let r = 1;
    let c = 1;
    const peticiones = mesasZona.map(m => {
      const targetCol = c;
      const targetRow = r;
      c++;
      if (c > zonaActual.columnas) {
        c = 1;
        r++;
      }
      return this.salonService.actualizarMesa(m.id, {
        posicionX: targetCol,
        posicionY: targetRow,
        zona: zonaActual.id
      });
    });

    forkJoin(peticiones).subscribe({
      next: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showSuccess(`Mesas de ${zonaActual.nombre} organizadas en cuadrícula`);
      },
      error: () => {
        this.isProcesandoMesa.set(false);
        this.notify.showError(
          '❌ Error al auto-organizar',
          'Falló la reubicación de mesas. Restaurando cuadrícula original...'
        );
        this.salonService.cargarMesas();
      }
    });
  }
}
