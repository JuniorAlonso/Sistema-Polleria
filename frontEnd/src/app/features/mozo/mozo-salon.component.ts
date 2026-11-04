import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalonService, ZonaSalonConfig } from '../../core/services/salon.service';
import { leerUserIdDelToken } from '../../core/utils/jwt.util';
import { Product } from '../../core/models/product.model';
import { TableStatus } from '../../core/models/table.model';
import { Order, OrderStatus } from '../../core/models/order.model';
import { AlertaPlatoListo, ComandaItem, MesaSalon, MozoTab } from './mozo.types';
import {
  esMesaParaCobrar as esMesaParaCobrarHelper,
  esMiComanda as esMiComandaHelper,
  etiquetaEstadoComanda as etiquetaEstadoComandaHelper,
  getCodeNum as getCodeNumHelper,
  horaDe as horaDeHelper,
  resumenItems as resumenItemsHelper,
  tiempoTranscurridoDesde as tiempoTranscurridoDesdeHelper
} from './mozo.helpers';
import { MozoSidebarComponent } from './components/mozo-sidebar.component';
import { MozoHeaderComponent } from './components/mozo-header.component';
import { MozoAlertBannerComponent } from './components/mozo-alert-banner.component';
import { MozoMesasFiltersComponent } from './components/mozo-mesas-filters.component';
import { MozoCroquisComponent } from './components/mozo-croquis.component';
import { MozoMesasCardsComponent } from './components/mozo-mesas-cards.component';
import { MozoMenuPickerComponent } from './components/mozo-menu-picker.component';
import { MozoOrderSummaryComponent } from './components/mozo-order-summary.component';
import { MozoAlertasListComponent } from './components/mozo-alertas-list.component';
import { MozoHistorialComponent } from './components/mozo-historial.component';
import { MozoMesaModalComponent } from './components/mozo-mesa-modal.component';

export type { MozoTab, MesaSalon, AlertaPlatoListo } from './mozo.types';

@Component({
  selector: 'app-mozo-salon',
  standalone: true,
  imports: [
    MozoSidebarComponent,
    MozoHeaderComponent,
    MozoAlertBannerComponent,
    MozoMesasFiltersComponent,
    MozoCroquisComponent,
    MozoMesasCardsComponent,
    MozoMenuPickerComponent,
    MozoOrderSummaryComponent,
    MozoAlertasListComponent,
    MozoHistorialComponent,
    MozoMesaModalComponent
  ],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">

      <app-mozo-sidebar
        [activeTab]="activeTab()"
        [mesasCount]="mesas().length"
        [alertasCount]="alertasPendientes().length"
        [userName]="auth.currentUser()?.nombre"
        (tabChange)="activeTab.set($event)"
        (logout)="cerrarSesion()"
      />

      <div class="flex-1 flex flex-col min-w-0 min-h-screen bg-[#0d0e11] overflow-y-auto">

        <app-mozo-header
          [tabLabel]="getActiveTabLabel()"
          [alertasCount]="alertasPendientes().length"
          (openAlertas)="activeTab.set('ALERTAS_COCINA')"
          (nuevaComanda)="abrirModalComandaRapida()"
        />

        <!-- Aviso fijo de comanda lista: guía la vista en todas las pestañas sin bloquear clicks -->
        @if (alertaPrincipal(); as a) {
          <app-mozo-alert-banner [alerta]="a" [miUserId]="miUserId()" (servir)="servirAlerta($event)" />
        }

        <!-- ================= TAB 1: MAPA DE MESAS ================= -->
        @if (activeTab() === 'MESAS') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">

            <app-mozo-mesas-filters
              [vistaMesas]="vistaMesas()"
              [selectedZone]="selectedZone()"
              [zonasSalon]="zonasSalon"
              [mesasCount]="mesas().length"
              (vistaChange)="vistaMesas.set($event)"
              (zoneChange)="selectedZone.set($event)"
            />

            @if (vistaMesas() === 'CROQUIS') {
              <app-mozo-croquis
                [zonasSalon]="zonasSalon"
                [currentZona]="currentZona()"
                [activeZonaIndex]="activeZonaIndex()"
                [mesas]="mesas()"
                [hasError]="salonService.hasError()"
                [isLoading]="salonService.isLoading()"
                [isProcesandoMesa]="isProcesandoMesa()"
                [mensajeProcesandoMesa]="mensajeProcesandoMesa()"
                [isAdmin]="auth.isAdmin()"
                [mesaEnMovimiento]="mesaEnMovimiento()"
                [selectedMesaId]="selectedMesaModal()?.id"
                [ahora]="tiempoActual()"
                (reintentar)="salonService.cargarMesas()"
                (prevZona)="prevZona()"
                (nextZona)="nextZona()"
                (zonaSelect)="setZonaIndex($event)"
                (ajustarFilas)="ajustarFilas($event)"
                (ajustarColumnas)="ajustarColumnas($event)"
                (cancelarMovimiento)="mesaEnMovimiento.set(null)"
                (casillaClick)="onCasillaClick($event.row, $event.col)"
                (dragStartMesa)="onDragStartMesa($event.event, $event.mesa)"
                (dragOverCasilla)="onDragOverCasilla($event)"
                (dropCasilla)="onDropCasilla($event.event, $event.row, $event.col)"
                (moverMesa)="iniciarMoverMesa($event.mesa, $event.event)"
              />
            } @else {
              <app-mozo-mesas-cards
                [mesas]="filteredMesas()"
                [ahora]="tiempoActual()"
                (seleccionar)="seleccionarMesa($event)"
              />
            }

          </main>
        }

        <!-- ================= TAB 2: TOMAR COMANDA RÁPIDA ================= -->
        @if (activeTab() === 'TOMAR_COMANDA') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <app-mozo-menu-picker
                [mesas]="mesas()"
                [products]="productsService.products()"
                [selectedMesaForOrder]="selectedMesaForOrder"
                (mesaChange)="selectedMesaForOrder = $any($event)"
                (agregar)="agregarItemComanda($event)"
              />

              <app-mozo-order-summary
                [mesaTitulo]="mesaParaComanda()?.numero ?? selectedMesaForOrder"
                [userName]="auth.currentUser()?.nombre"
                [ordenActivaId]="mesaParaComanda()?.ordenId"
                [estadoComandaLabel]="comandaMesa()?.estado ? etiquetaEstadoComanda(comandaMesa()!.estado) : ''"
                [items]="comandaItems"
                [total]="calcularTotalComanda()"
                (eliminar)="eliminarItemComanda($event)"
                (notasChange)="actualizarNotasItem($event.index, $event.notas)"
                (enviar)="enviarComandaACocina()"
              />

            </div>

          </main>
        }

        <!-- ================= TAB 3: ALERTAS DE COCINA ================= -->
        @if (activeTab() === 'ALERTAS_COCINA') {
          <main class="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
            <app-mozo-alertas-list
              [alertas]="alertasPendientes()"
              [miUserId]="miUserId()"
              (servir)="servirAlerta($event)"
            />
          </main>
        }

        <!-- ================= TAB 4: HISTORIAL & COBROS DEL TURNO ================= -->
        @if (activeTab() === 'HISTORIAL_TURNO') {
          <main class="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
            <app-mozo-historial
              [historialSalon]="historialSalon()"
              [mesasAtendidasHoy]="mesasAtendidasHoy()"
              [totalCobradoTurno]="totalCobradoTurno()"
              [comandasActivasSalon]="comandasActivasSalon()"
            />
          </main>
        }

        <!-- ================= MODAL DETALLE DE MESA & COBRO ================= -->
        @if (selectedMesaModal(); as mesaModal) {
          <app-mozo-mesa-modal
            [mesa]="mesaModal"
            [comandaMesa]="comandaMesa()"
            [cargandoComanda]="cargandoComanda()"
            [errorComanda]="errorComanda()"
            [isAdmin]="auth.isAdmin()"
            [ahora]="tiempoActual()"
            (cerrar)="cerrarModalMesa()"
            (iniciarComanda)="iniciarComandaParaMesa($event)"
            (cambiarEstado)="cambiarEstadoMesa($event)"
            (posicionXChange)="mesaModal.posicionX = $event"
            (posicionYChange)="mesaModal.posicionY = $event"
            (guardarPosicion)="guardarPosicionMesaModal()"
            (servirMesa)="servirMesaSeleccionada()"
            (cobrar)="cobrarMesaModal()"
          />
        }

      </div>
    </div>
  `
})
export class MozoSalonComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly productsService = inject(ProductsService);
  readonly salonService = inject(SalonService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly activeTab = signal<MozoTab>('MESAS');
  readonly selectedZone = signal<string>('TODAS');
  readonly selectedMesaModal = signal<MesaSalon | null>(null);
  readonly comandaMesa = signal<Order | null>(null);
  readonly cargandoComanda = signal<boolean>(false);
  readonly errorComanda = signal<string | null>(null);
  private comandaRequestId = 0;
  readonly vistaMesas = signal<'CROQUIS' | 'TARJETAS'>('CROQUIS');

  // Croquis Virtual por Zonas (Slides) & Cuadrícula Personalizable
  get zonasSalon(): ZonaSalonConfig[] {
    return this.salonService.zonasSalon();
  }

  readonly activeZonaIndex = signal<number>(0);
  readonly currentZona = computed(() => this.salonService.zonasSalon()[this.activeZonaIndex()] || this.salonService.zonasSalon()[0]);
  readonly mesaEnMovimiento = signal<MesaSalon | null>(null);

  // Estado de Carga y Espera para Operaciones de Salón
  readonly isProcesandoMesa = signal<boolean>(false);
  readonly mensajeProcesandoMesa = signal<string>('Sincronizando con el servidor...');

  private timerInterval: any = null;
  readonly tiempoActual = signal<number>(Date.now());

  selectedMesaForOrder = 1;
  comandaItems: ComandaItem[] = [];

  // Mesas sincronizadas de SalonService (sin fallbacks mock)
  readonly mesas = computed<MesaSalon[]>(() => {
    const backendMesas = this.salonService.mesas();
    return backendMesas.map(bm => ({
      id: Number(bm.id),
      numero: bm.numero,
      nombre: `Mesa ${bm.numero.toString().padStart(2, '0')}`,
      zona: bm.zona || 'SALON_PRINCIPAL',
      capacidad: bm.capacidad,
      estado: bm.estado,
      posicionX: bm.posicionX || 1,
      posicionY: bm.posicionY || 1,
      comensales: bm.ordenActiva ? bm.capacidad : 0,
      tiempoMinutos: bm.ordenActiva ? bm.ordenActiva.tiempoEsperaMinutos : 0,
      totalConsumo: bm.ordenActiva ? bm.ordenActiva.total : 0,
      platosListos: bm.ordenActiva ? bm.ordenActiva.estadoOrden === 'LISTO' && !bm.ordenActiva.servidoEn : false,
      mozoId: bm.ordenActiva?.mozoId,
      mozo: bm.mozoAsignado || 'Mozo Salón',
      ordenId: bm.ordenActiva ? String(bm.ordenActiva.ordenId) : undefined,
      servidoEn: bm.ordenActiva?.servidoEn ?? null,
      creadoEn: bm.ordenActiva?.creadoEn ?? null
    }));
  });

  esMesaParaCobrar(mesa: MesaSalon | null | undefined): boolean {
    return esMesaParaCobrarHelper(mesa);
  }

  tiempoTranscurridoDesde(fechaIso?: string | null): string {
    return tiempoTranscurridoDesdeHelper(fechaIso, this.tiempoActual());
  }

  iniciarComandaParaMesa(mesa: MesaSalon): void {
    this.selectedMesaForOrder = mesa.id;
    this.cerrarModalMesa();
    this.activeTab.set('TOMAR_COMANDA');
    this.notify.showInfo(`Mesa ${mesa.nombre} seleccionada`, 'Seleccioná los platos de la carta para registrar la comanda.');
  }

  /**
   * La alerta se deriva del estado real de la mesa (LISTO y sin `servidoEn`), no de un log local:
   * al servir la comanda desaparece y no vuelve al recargar.
   */
  readonly alertasPendientes = computed<AlertaPlatoListo[]>(() =>
    this.mesas()
      .filter(m => !!m.ordenId && !!m.platosListos)
      .map(m => ({
        id: `MESA-${m.id}`,
        ordenId: m.ordenId,
        mozoId: m.mozoId,
        mesa: m.nombre,
        plato: 'Comanda lista para servir',
        cantidad: 1,
        hora: '',
        atendido: false
      }))
  );

  /** Alerta que alimenta el banner fijo visible en todas las pestañas. */
  readonly alertaPrincipal = computed(() => this.alertasPendientes()[0] ?? null);

  readonly miUserId = computed(() => leerUserIdDelToken(this.auth.token()));

  esMiComanda(alerta: AlertaPlatoListo): boolean {
    return esMiComandaHelper(alerta, this.miUserId());
  }

  readonly filteredMesas = computed(() => {
    const zone = this.selectedZone();
    if (zone === 'TODAS') return this.mesas();
    return this.mesas().filter(m => m.zona === zone);
  });

  // S4.6: historial del turno con los datos reales de /ordenes (sin filas ni totales inventados).
  readonly historialSalon = computed(() =>
    this.ordersService.orders().filter(o => o.tipo === 'SALON' && o.estado === 'COMPLETADO')
  );
  readonly mesasAtendidasHoy = computed(() => this.historialSalon().length);
  readonly totalCobradoTurno = computed(() =>
    this.historialSalon().reduce((acc, o) => acc + (o.total || 0), 0)
  );
  readonly comandasActivasSalon = computed(() =>
    this.ordersService.orders().filter(o =>
      o.tipo === 'SALON' && !['COMPLETADO', 'CANCELADO'].includes(o.estado)
    )
  );

  ngOnInit(): void {
    this.productsService.loadProducts();
    this.salonService.cargarMesas();
    this.ordersService.loadActiveOrders();
    if (isPlatformBrowser(this.platformId)) {
      this.timerInterval = setInterval(() => {
        this.tiempoActual.set(Date.now());
      }, 30000);
    }
  }

  getActiveTabLabel(): string {
    switch (this.activeTab()) {
      case 'MESAS': return 'Control de Mesas & Salón';
      case 'TOMAR_COMANDA': return 'Toma de Comanda Móvil';
      case 'ALERTAS_COCINA': return 'Avisos en Vivo de Cocina';
      case 'HISTORIAL_TURNO': return 'Historial & Arqueo de Turno';
      default: return 'Panel Mozo';
    }
  }

  seleccionarMesa(m: MesaSalon): void {
    this.selectedMesaModal.set({ ...m });
    this.cargarComandaMesa(m.ordenId);
  }

  /**
   * S6.5: lee del backend la comanda real de la mesa seleccionada (solo lectura).
   * Los tres estados del bloque «Comanda Acumulada» son cargando, comanda real y error.
   */
  private cargarComandaMesa(ordenId?: string): void {
    const requestId = ++this.comandaRequestId;
    this.comandaMesa.set(null);
    this.errorComanda.set(null);

    if (!ordenId) {
      this.cargandoComanda.set(false);
      return;
    }

    this.cargandoComanda.set(true);
    this.ordersService.obtenerOrden(ordenId).subscribe({
      next: (orden) => {
        if (requestId !== this.comandaRequestId) return;
        this.cargandoComanda.set(false);
        this.comandaMesa.set(orden);
      },
      error: (err) => {
        if (requestId !== this.comandaRequestId) return;
        this.cargandoComanda.set(false);
        this.errorComanda.set(err?.message || 'No se pudo cargar la comanda de la mesa');
      }
    });
  }

  cerrarModalMesa(): void {
    this.comandaRequestId++;
    this.comandaMesa.set(null);
    this.errorComanda.set(null);
    this.cargandoComanda.set(false);
    this.selectedMesaModal.set(null);
  }

  etiquetaEstadoComanda(estado: OrderStatus): string {
    return etiquetaEstadoComandaHelper(estado);
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
    if (!this.auth.isAdmin()) {
      this.notify.showWarning('Acción no permitida', 'Solo los administradores pueden modificar la cuadrícula del salón.');
      return;
    }
    const z = this.currentZona();
    if (z) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Ajustando cuadrícula de ${z.nombre}...`);
      this.salonService.ajustarDimensionesZona(z.id, delta, 0);
      setTimeout(() => this.isProcesandoMesa.set(false), 250);
    }
  }

  ajustarColumnas(delta: number): void {
    if (!this.auth.isAdmin()) {
      this.notify.showWarning('Acción no permitida', 'Solo los administradores pueden modificar la cuadrícula del salón.');
      return;
    }
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
    return this.mesas().find(m => 
      (m.zona || 'SALON_PRINCIPAL') === zonaId &&
      Number(m.posicionY) === row &&
      Number(m.posicionX) === col
    );
  }

  iniciarMoverMesa(mesa: MesaSalon, event?: Event): void {
    if (!this.auth.isAdmin()) {
      this.notify.showWarning('Acción no permitida', 'Solo los administradores pueden reubicar mesas en la cuadrícula.');
      return;
    }
    if (event) event.stopPropagation();
    if (this.mesaEnMovimiento()?.id === mesa.id) {
      this.mesaEnMovimiento.set(null);
    } else {
      this.mesaEnMovimiento.set(mesa);
      this.notify.showInfo(`Mesa ${mesa.nombre} seleccionada. Toca una casilla vacía para reubicarla.`);
    }
  }

  onCasillaClick(row: number, col: number): void {
    const mesaExistente = this.getMesaEnCasilla(row, col);
    if (mesaExistente) {
      if (this.mesaEnMovimiento() && this.mesaEnMovimiento()?.id !== mesaExistente.id) {
        this.notify.showWarning(`La casilla F${row}:C${col} ya está ocupada por ${mesaExistente.nombre}`);
      } else {
        this.seleccionarMesa(mesaExistente);
      }
      return;
    }

    if (this.mesaEnMovimiento()) {
      if (!this.auth.isAdmin()) {
        this.mesaEnMovimiento.set(null);
        return;
      }
      const enMovimiento = this.mesaEnMovimiento()!;
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando ${enMovimiento.nombre} a F${row}:C${col}...`);
      enMovimiento.posicionX = col;
      enMovimiento.posicionY = row;
      enMovimiento.zona = this.currentZona().id;
      this.salonService.actualizarPosicion(enMovimiento.id, col, row).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.notify.showSuccess(`${enMovimiento.nombre} reubicada en ${this.currentZona().nombre} (F${row}:C${col})`);
        },
        error: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
  }

  onDragStartMesa(event: DragEvent, mesa: MesaSalon): void {
    if (!this.auth.isAdmin()) return;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(mesa.id));
      this.mesaEnMovimiento.set(mesa);
    }
  }

  onDragOverCasilla(event: DragEvent): void {
    if (!this.auth.isAdmin()) return;
    event.preventDefault();
  }

  onDropCasilla(event: DragEvent, row: number, col: number): void {
    if (!this.auth.isAdmin()) return;
    event.preventDefault();
    if (this.getMesaEnCasilla(row, col)) {
      this.notify.showWarning(`La casilla ya está ocupada`);
      return;
    }
    const mesaIdStr = event.dataTransfer?.getData('text/plain');
    const mesaId = mesaIdStr ? Number(mesaIdStr) : this.mesaEnMovimiento()?.id;
    const mesa = this.mesas().find(m => m.id === mesaId);
    if (mesa) {
      this.isProcesandoMesa.set(true);
      this.mensajeProcesandoMesa.set(`Reubicando ${mesa.nombre} a F${row}:C${col}...`);
      this.salonService.actualizarPosicion(mesa.id, col, row).subscribe({
        next: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.notify.showSuccess(`${mesa.nombre} reubicada en ${this.currentZona().nombre} (F${row}:C${col})`);
        },
        error: () => {
          this.isProcesandoMesa.set(false);
          this.mesaEnMovimiento.set(null);
          this.salonService.cargarMesas();
        }
      });
    }
  }

  abrirModalComandaRapida(): void {
    this.activeTab.set('TOMAR_COMANDA');
  }

  agregarItemComanda(prod: Product): void {
    const exist = this.comandaItems.find(i => i.producto.id === prod.id);
    if (exist) {
      this.comandaItems = this.comandaItems.map(i =>
        i === exist ? { ...i, cantidad: i.cantidad + 1 } : i
      );
    } else {
      this.comandaItems = [...this.comandaItems, { producto: prod, cantidad: 1, notas: '' }];
    }
    this.notify.showSuccess(`Agregado: ${prod.nombre}`);
  }

  eliminarItemComanda(index: number): void {
    this.comandaItems = this.comandaItems.filter((_, i) => i !== index);
  }

  actualizarNotasItem(index: number, notas: string): void {
    this.comandaItems = this.comandaItems.map((item, i) => (i === index ? { ...item, notas } : item));
  }

  calcularTotalComanda(): number {
    return this.comandaItems.reduce((acc, i) => acc + (i.producto.precio * i.cantidad), 0);
  }

  /** Mesa elegida en la pestaña Tomar Comanda (selectedMesaForOrder es un valor plano de ngModel). */
  mesaParaComanda(): MesaSalon | undefined {
    const mesaId = Number(this.selectedMesaForOrder);
    return this.mesas().find(m => m.id === mesaId);
  }

  /** «1x Chaufa de Pollo, 2x Inca Kola» a partir de los ítems reales de la orden. */
  resumenItems(o: Order): string {
    return resumenItemsHelper(o);
  }

  horaDe(iso: string): string {
    return horaDeHelper(iso);
  }

  getCodeNum(code: string): string {
    return getCodeNumHelper(code);
  }

  /**
   * S4.5: si la mesa elegida ya tiene comanda activa, los platos se agregan a ESA orden
   * (`POST /ordenes/{id}/items`); si no, se abre la comanda de salón.
   */
  enviarComandaACocina(): void {
    const mesaId = Number(this.selectedMesaForOrder);
    const mesa = this.mesas().find(m => m.id === mesaId);
    if (!mesa) {
      this.notify.showError('Seleccioná una mesa válida');
      return;
    }

    if (this.comandaItems.length === 0) return;

    const itemsReq = this.comandaItems.map(item => ({
      productoId: item.producto.id,
      cantidad: item.cantidad,
      notas: item.notas
    }));

    const alTerminar = (): void => {
      // El backend ya dejó la mesa ocupada y con la comanda actualizada: recargamos el salón.
      this.salonService.cargarMesas();
      this.comandaItems = [];
      this.activeTab.set('MESAS');
    };

    if (mesa.ordenId) {
      this.ordersService.agregarItemsAOrden(mesa.ordenId, itemsReq).subscribe({
        next: () => {
          const platos = itemsReq.reduce((acc, i) => acc + i.cantidad, 0);
          this.notify.showSuccess(`${platos} platos agregados a la comanda de ${mesa.nombre}`);
          alTerminar();
        },
        error: (err) => {
          const mensaje = err?.message || 'El servidor rechazó los platos nuevos';
          this.notify.showError('No se pudieron agregar los platos', mensaje);
        }
      });
      return;
    }

    const numeroMesa = mesa.numero ?? mesa.id;
    this.ordersService.createOrder({
      tipo: 'SALON',
      mesaId,
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      cliente: {
        // La comanda de salón no tiene celular del cliente: no se inventa uno.
        nombre: `Mesa ${String(numeroMesa).padStart(2, '0')}`,
        celular: '',
        mesaNumero: numeroMesa
      },
      items: itemsReq
    }).subscribe({
      next: (created) => {
        this.notify.showSuccess(`Comanda creada en cocina para ${mesa.nombre} (Orden #${created.codigoSeguimiento})`);
        alTerminar();
      },
      error: (err) => {
        const mensaje = err?.message || err?.error?.error || err?.error?.message
          || 'Compruebe conexión con orders-service';
        this.notify.showError('Error al enviar comanda', mensaje);
      }
    });
  }

  /**
   * S3.3: «Servir en mesa» se persiste con POST /ordenes/{id}/servir. La orden sigue en LISTO:
   * la mesa se libera recién al cobrar.
   */
  servirAlerta(alerta: AlertaPlatoListo): void {
    if (!alerta.ordenId) {
      this.notify.showWarning('Comanda no disponible',
        'La mesa no tiene una comanda activa para marcar como servida.');
      return;
    }

    this.ordersService.marcarServido(alerta.ordenId).subscribe({
      next: () => {
        this.quitarAvisoDeCocina(alerta.ordenId!);
        const mesa = this.mesas().find(m => m.ordenId === alerta.ordenId);
        if (mesa) {
          this.salonService.actualizarEstado(mesa.id, 'POR_COBRAR').subscribe({
            next: () => this.salonService.cargarMesas(),
            error: () => this.salonService.cargarMesas()
          });
        } else {
          this.salonService.cargarMesas();
        }
        this.notify.showSuccess(`${alerta.mesa}: comanda servida, mesa lista para cobrar`);
      },
      error: (err) => {
        this.notify.showError('No se pudo marcar la comanda como servida',
          err?.message || 'Compruebe conexión con orders-service');
      }
    });
  }

  /** Misma marca persistida, desde el inspector de mesa (modal). */
  servirMesaSeleccionada(): void {
    const m = this.selectedMesaModal();
    const ordenId = m?.ordenId;
    if (!ordenId || !m) {
      this.notify.showWarning('Comanda no disponible',
        'La mesa no tiene una comanda activa para marcar como servida.');
      return;
    }

    this.ordersService.marcarServido(ordenId).subscribe({
      next: () => {
        this.quitarAvisoDeCocina(ordenId);
        this.salonService.actualizarEstado(m.id, 'POR_COBRAR').subscribe({
          next: () => {
            this.salonService.cargarMesas();
            this.cargarComandaMesa(ordenId);
          },
          error: () => {
            this.salonService.cargarMesas();
            this.cargarComandaMesa(ordenId);
          }
        });
        this.notify.showSuccess(`${m?.nombre ?? 'Mesa'}: comanda servida, mesa lista para cobrar`);
      },
      error: (err) => {
        this.notify.showError('No se pudo marcar la comanda como servida',
          err?.message || 'Compruebe conexión con orders-service');
      }
    });
  }

  private quitarAvisoDeCocina(ordenId: string): void {
    this.salonService.alertasCocina.update(prev =>
      prev.filter(ac => String(ac.ordenId) !== String(ordenId))
    );
  }

  /** userId del JWT (payload sin verificar firma: el backend ya la validó). */
  /**
   * El claim `userId` lo decodifica el util compartido (con su propio spec); acá solo se consume.
   */

  cambiarEstadoMesa(estado: TableStatus): void {
    const m = this.selectedMesaModal();
    if (!m) return;

    if (estado === 'LIBRE' || estado === 'EN_LIMPIEZA') {
      const comanda = this.comandaMesa();
      const comandaActiva = comanda && !['COMPLETADO', 'CANCELADO'].includes(comanda.estado)
        ? comanda.id
        : undefined;
      const ordenId = comandaActiva ?? m.ordenId;
      if (ordenId) {
        this.notify.showWarning('Comanda activa',
          `Cobrá o cancelá la comanda #${this.getCodeNum(String(ordenId))} antes de pasar la mesa a ${estado}.`);
        return;
      }
    }

    this.salonService.actualizarEstado(m.id, estado).subscribe({
      next: (upd) => {
        m.estado = upd.estado;
        this.cerrarModalMesa();
      },
      error: () => {
        this.cerrarModalMesa();
        this.salonService.cargarMesas();
      }
    });
  }

  guardarPosicionMesaModal(): void {
    if (!this.auth.isAdmin()) {
      this.notify.showWarning('Acción no permitida', 'Solo los administradores pueden modificar la posición de las mesas.');
      return;
    }
    const m = this.selectedMesaModal();
    if (m && m.posicionX !== undefined && m.posicionY !== undefined) {
      this.salonService.actualizarPosicion(m.id, m.posicionX, m.posicionY).subscribe();
    }
  }

  /**
   * S6.4: si la mesa tiene comanda activa, el cobro cierra la orden (ENTREGADO en el backend,
   * que además libera la mesa). Sin comanda activa se conserva la liberación directa de la mesa.
   * Un rechazo del backend se muestra tal cual y nunca anuncia un éxito inexistente.
   */
  cobrarMesaModal(): void {
    const m = this.selectedMesaModal();
    if (!m) return;

    if (m.ordenId) {
      const estadoActual = this.comandaMesa()?.estado;
      this.ordersService.completarOrdenSalon(m.ordenId, estadoActual).subscribe({
        next: () => {
          this.salonService.cargarMesas();
          this.ordersService.loadActiveOrders();
          this.cerrarModalMesa();
          this.notify.showSuccess(`Cuenta cobrada para ${m.nombre}. La comanda quedó cerrada.`);
        },
        error: (err) => {
          const motivo = err?.error?.error || err?.error?.mensaje || err?.error?.message
            || err?.message || 'El backend rechazó el cierre de la comanda';
          this.notify.showError('No se pudo cobrar la cuenta', motivo);
        }
      });
      return;
    }

    this.salonService.actualizarEstado(m.id, 'LIBRE').subscribe({
      next: () => {
        this.cerrarModalMesa();
        this.notify.showSuccess(`Mesa ${m.nombre} liberada`);
      },
      error: () => {
        this.cerrarModalMesa();
        this.salonService.cargarMesas();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.mesaEnMovimiento.set(null);
    this.cerrarModalMesa();
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.notify.showInfo('Sesión finalizada', 'Has salido del módulo de mozo.');
    this.router.navigate(['/login']);
  }
}
