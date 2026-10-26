import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { FinanceService } from '../../core/services/finance.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order } from '../../core/models/order.model';
import { TipoMovimiento } from '../../core/models/finance.model';
import { InventoryService } from '../../core/services/inventory.service';
import { BackendLiquidacionResponse } from '../../core/models/api-contracts.model';
import { CajeroTab, MetodoCobro } from './models/cajero.models';
import { CajeroSidebarComponent } from './components/cajero-sidebar.component';
import { CajeroTopbarComponent } from './components/cajero-topbar.component';
import { CajeroPosTabComponent } from './components/cajero-pos-tab.component';
import { CajeroArqueoTabComponent } from './components/cajero-arqueo-tab.component';
import { CajeroHistorialTabComponent } from './components/cajero-historial-tab.component';
import { CajeroLlamadasTabComponent } from './components/cajero-llamadas-tab.component';
import { CajeroLiquidacionesTabComponent } from './components/cajero-liquidaciones-tab.component';
import { CajeroMermasTabComponent } from './components/cajero-mermas-tab.component';
import { CajeroCobroModalComponent } from './components/cajero-cobro-modal.component';
import { CajeroTicketModalComponent } from './components/cajero-ticket-modal.component';
import { CajeroMovimientoModalComponent } from './components/cajero-movimiento-modal.component';
import { CajeroCierreModalComponent } from './components/cajero-cierre-modal.component';
import { CajeroNuevaLiquidacionModalComponent } from './components/cajero-nueva-liquidacion-modal.component';
import { CajeroCierreLiquidacionModalComponent } from './components/cajero-cierre-liquidacion-modal.component';

export type { CajeroTab, MetodoCobro };

@Component({
  selector: 'app-cajero-dashboard',
  standalone: true,
  imports: [
    CajeroSidebarComponent,
    CajeroTopbarComponent,
    CajeroPosTabComponent,
    CajeroArqueoTabComponent,
    CajeroHistorialTabComponent,
    CajeroLlamadasTabComponent,
    CajeroLiquidacionesTabComponent,
    CajeroMermasTabComponent,
    CajeroCobroModalComponent,
    CajeroTicketModalComponent,
    CajeroMovimientoModalComponent,
    CajeroCierreModalComponent,
    CajeroNuevaLiquidacionModalComponent,
    CajeroCierreLiquidacionModalComponent
  ],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">

      <!-- ================= SIDEBAR LATERAL CAJERO ================= -->
      <app-cajero-sidebar
        [activeTab]="activeTab()"
        (tabChange)="activeTab.set($event)"
        [cajaAbierta]="cajaAbierta()"
        [fondoApertura]="financeService.cajaActual()?.montoApertura || 0"
        [totalPorCobrar]="comandasPorCobrar().length"
        [totalLlamadas]="ordenesPendientesLlamada().length"
        [totalLiquidaciones]="liquidacionesAbiertas().length"
        [totalFantasma]="ordenesFantasma().length"
        [totalCobros]="cobrosDelDia().length"
        [usuarioNombre]="auth.currentUser()?.nombre"
        (logout)="cerrarSesion()"
      />

      <!-- ================= CONTENIDO PRINCIPAL ================= -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">

        <app-cajero-topbar
          [activeTab]="activeTab()"
          [horaActual]="horaActual()"
          [cargando]="cargando()"
          (refrescar)="refrescarTodo()"
        />

        <!-- Contenedor del Cuerpo de la Vista -->
        <div class="p-4 sm:p-6 flex-1 space-y-6">

          @if (activeTab() === 'POS') {
            <app-cajero-pos-tab
              [cajaAbierta]="cajaAbierta()"
              [filtroTipo]="filtroTipo()"
              (filtroTipoChange)="filtroTipo.set($event)"
              [totalPorCobrar]="comandasPorCobrar().length"
              [comandas]="comandasFiltradas()"
              [(busquedaTexto)]="busquedaTexto"
              (abrirCaja)="activeTab.set('ARQUEO')"
              (cobrar)="seleccionarOrdenParaCobro($event)"
            />
          }

          @if (activeTab() === 'ARQUEO') {
            <app-cajero-arqueo-tab
              [cajaAbierta]="cajaAbierta()"
              [caja]="financeService.cajaActual()"
              [movimientos]="financeService.movimientos()"
              [totalIngresos]="totalIngresosCaja()"
              [totalEgresos]="totalEgresosCaja()"
              [saldoTeorico]="saldoTeoricoActual()"
              [usuarioNombre]="auth.currentUser()?.nombre"
              [procesando]="procesandoAccion()"
              [(montoApertura)]="montoAperturaInput"
              [(observacionesApertura)]="observacionesAperturaInput"
              (aperturar)="ejecutarAperturaCaja()"
              (nuevoMovimiento)="abrirModalMovimiento()"
              (cerrarCaja)="abrirModalCierre()"
            />
          }

          @if (activeTab() === 'HISTORIAL') {
            <app-cajero-historial-tab
              [cobros]="cobrosDelDia()"
              [totalCobrado]="totalCobradoHoy()"
              (reimprimir)="reimprimirTicket($event)"
            />
          }

          @if (activeTab() === 'LLAMADAS_CONTRAPAGO') {
            <app-cajero-llamadas-tab
              [ordenes]="ordenesPendientesLlamada()"
              (confirmar)="confirmarLlamadaPedido($event)"
              (noContesta)="intentoLlamadaPedido($event)"
              (cancelar)="cancelarPedidoContraPago($event)"
            />
          }

          @if (activeTab() === 'LIQUIDACIONES') {
            <app-cajero-liquidaciones-tab
              [liquidaciones]="liquidacionesAbiertas()"
              (nuevaLiquidacion)="mostrarModalNuevaLiquidacion.set(true)"
              (rendir)="abrirModalCierreLiquidacion($event)"
            />
          }

          @if (activeTab() === 'MERMAS_FANTASMA') {
            <app-cajero-mermas-tab
              [ordenes]="ordenesFantasma()"
              (resolver)="resolverProductoFantasma($event.orden, $event.destino)"
            />
          }

        </div>
      </main>

      <!-- ================= MODAL DE COBRO DE ORDEN ================= -->
      @if (ordenSeleccionada(); as orden) {
        <app-cajero-cobro-modal
          [orden]="orden"
          [(metodo)]="metodoCobroSeleccionado"
          [(efectivoRecibido)]="efectivoRecibidoInput"
          [(referencia)]="referenciaPagoInput"
          [vuelto]="vueltoCalculado()"
          [cobroValido]="esCobroValido()"
          [procesando]="procesandoAccion()"
          (cerrar)="cerrarModalCobro()"
          (confirmar)="confirmarCobroComanda()"
          (exacto)="efectivoRecibidoInput = ordenSeleccionada()?.total || 0"
          (sumar)="sumarEfectivo($event)"
        />
      }

      <!-- ================= MODAL TICKET / COMPROBANTE DE PAGO ================= -->
      @if (ticketEmitido(); as ticket) {
        <app-cajero-ticket-modal
          [ticket]="ticket"
          (imprimir)="imprimirTicket()"
          (cerrar)="ticketEmitido.set(null)"
        />
      }

      <!-- ================= MODAL REGISTRO DE MOVIMIENTO CAJA CHICA ================= -->
      @if (mostrarModalMovimiento()) {
        <app-cajero-movimiento-modal
          [(tipo)]="tipoMovimientoInput"
          [(monto)]="montoMovimientoInput"
          [(motivo)]="motivoMovimientoInput"
          [procesando]="procesandoAccion()"
          (cancelar)="mostrarModalMovimiento.set(false)"
          (guardar)="guardarMovimientoCaja()"
        />
      }

      <!-- ================= MODAL CIERRE DE CAJA & ARQUEO ================= -->
      @if (mostrarModalCierre()) {
        <app-cajero-cierre-modal
          [saldoTeorico]="saldoTeoricoActual()"
          [diferencia]="diferenciaCierre()"
          [(efectivo)]="efectivoCierreInput"
          [(pos)]="posCierreInput"
          [(digitales)]="digitalesCierreInput"
          [(observaciones)]="observacionesCierreInput"
          [procesando]="procesandoAccion()"
          (cancelar)="mostrarModalCierre.set(false)"
          (confirmar)="ejecutarCierreCaja()"
        />
      }

      <!-- MODAL APERTURA LIQUIDACIÓN MOTORIZADO -->
      @if (mostrarModalNuevaLiquidacion()) {
        <app-cajero-nueva-liquidacion-modal
          [(repartidorNombre)]="repartidorNombreLiqInput"
          [(fondoInicial)]="fondoInicialLiqInput"
          [(observaciones)]="observacionesLiqInput"
          (cancelar)="mostrarModalNuevaLiquidacion.set(false)"
          (aperturar)="ejecutarAperturaLiquidacion()"
        />
      }

      <!-- MODAL CIERRE Y RENDICIÓN DE LIQUIDACIÓN -->
      @if (mostrarModalCierreLiquidacion()) {
        <app-cajero-cierre-liquidacion-modal
          [liquidacion]="liquidacionSeleccionada()"
          [(totalRendido)]="totalRendidoLiqInput"
          (cancelar)="mostrarModalCierreLiquidacion.set(false)"
          (confirmar)="confirmarCierreLiquidacion()"
        />
      }

    </div>
  `
})
export class CajeroDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly paymentService = inject(PaymentService);
  readonly financeService = inject(FinanceService);
  readonly inventoryService = inject(InventoryService);
  readonly auth = inject(AuthService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // Estados reactivos
  readonly activeTab = signal<CajeroTab>('POS');
  readonly filtroTipo = signal<string>('TODAS');
  busquedaTexto = '';
  readonly cargando = signal<boolean>(false);
  readonly procesandoAccion = signal<boolean>(false);

  // Hora actual
  readonly horaActual = signal<string>('');
  private timerSub?: Subscription;
  private autoRefreshSub?: Subscription;

  // Selección de comanda para cobro
  readonly ordenSeleccionada = signal<Order | null>(null);
  readonly metodoCobroSeleccionado = signal<MetodoCobro>('EFECTIVO');
  efectivoRecibidoInput = 0;
  referenciaPagoInput = '';

  // Ticket emitido
  readonly ticketEmitido = signal<any | null>(null);

  // Modales de Caja
  montoAperturaInput = 200;
  observacionesAperturaInput = '';
  readonly mostrarModalMovimiento = signal<boolean>(false);
  tipoMovimientoInput: TipoMovimiento = 'EGRESO';
  montoMovimientoInput = 0;
  motivoMovimientoInput = '';

  readonly mostrarModalCierre = signal<boolean>(false);
  efectivoCierreInput = 0;
  posCierreInput = 0;
  digitalesCierreInput = 0;
  observacionesCierreInput = '';

  // --- Módulos Operativos Nuevos: Llamadas, Liquidaciones y Mermas ---
  readonly ordenesPendientesLlamada = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'PENDIENTE_CONFIRMACION')
  );

  readonly ordenesFantasma = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'PEDIDO_FANTASMA')
  );

  readonly liquidacionesAbiertas = signal<BackendLiquidacionResponse[]>([]);
  readonly mostrarModalNuevaLiquidacion = signal<boolean>(false);
  readonly mostrarModalCierreLiquidacion = signal<boolean>(false);
  readonly liquidacionSeleccionada = signal<BackendLiquidacionResponse | null>(null);

  repartidorIdLiqInput = 4;
  repartidorNombreLiqInput = 'Carlos Motorizado';
  fondoInicialLiqInput = 50.0;
  totalRendidoLiqInput = 0;
  observacionesLiqInput = '';

  // Registro combinado de cobros aprobados desde el microservicio de pagos
  readonly cobrosDelDia = computed(() => {
    const ordersMap = new Map(this.ordersService.orders().map(o => [String(o.id), o]));
    const pagosAprobados = this.paymentService.pagos().filter(p => p.estado === 'APROBADO');
    return pagosAprobados.map(p => {
      const o = ordersMap.get(String(p.orderId));
      return {
        id: p.id,
        fechaHora: p.fechaTransaccion,
        ordenId: p.orderId,
        codigoOrden: o?.codigoSeguimiento ? String(o.codigoSeguimiento).replace(/^POL-?/, '') : String(p.orderId),
        clienteNombre: o?.cliente?.nombre || 'Cliente San Pollo',
        tipoOrden: o?.tipo || 'DELIVERY',
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.numeroOperacion || 'Cobro aprobado',
        items: o?.items || [],
        cajero: this.auth.currentUser()?.nombre || 'Cajero de Turno'
      };
    });
  });

  // Computed: Caja abierta
  readonly cajaAbierta = computed(() => {
    const caja = this.financeService.cajaActual();
    return !!caja && caja.estado === 'ABIERTA';
  });

  // Computed: Comandas que esperan cobro
  // Se excluyen pedidos cancelados, completados O que ya tengan su pago APROBADO en el backend
  readonly comandasPorCobrar = computed(() => {
    const pagosMap = this.paymentService.pagosPorOrdenMap();
    return this.ordersService.orders().filter(o => {
      if (['CANCELADO', 'COMPLETADO'].includes(o.estado) || o.estado === 'PAGADO') return false;
      const pago = pagosMap.get(String(o.id));
      return !pago || pago.estado !== 'APROBADO';
    });
  });

  readonly comandasFiltradas = computed(() => {
    let list = this.comandasPorCobrar();

    if (this.filtroTipo() !== 'TODAS') {
      list = list.filter(o => o.tipo === this.filtroTipo());
    }

    const q = this.busquedaTexto.trim().toLowerCase();
    if (q) {
      list = list.filter(o => 
        (o.codigoSeguimiento && o.codigoSeguimiento.toLowerCase().includes(q)) ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.cliente?.nombre && o.cliente.nombre.toLowerCase().includes(q)) ||
        (o.cliente?.mesaNumero && String(o.cliente.mesaNumero).includes(q))
      );
    }

    return list;
  });

  // Cálculos de saldo de caja
  readonly totalIngresosCaja = computed(() => {
    return this.financeService.movimientos()
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  });

  readonly totalEgresosCaja = computed(() => {
    return this.financeService.movimientos()
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + (m.monto || 0), 0);
  });

  readonly saldoTeoricoActual = computed(() => {
    const apertura = this.financeService.cajaActual()?.montoApertura || 0;
    return apertura + this.totalIngresosCaja() - this.totalEgresosCaja();
  });

  // Método (no computed): efectivoRecibidoInput es un campo plano enlazado con ngModel,
  // un computed() no detecta sus cambios y el vuelto se quedaba congelado en 0.
  vueltoCalculado(): number {
    const total = this.ordenSeleccionada()?.total || 0;
    const recibido = Number(this.efectivoRecibidoInput) || 0;
    return Math.max(0, Math.round((recibido - total) * 100) / 100);
  }

  readonly diferenciaCierre = computed(() => {
    return this.efectivoCierreInput - this.saldoTeoricoActual();
  });

  readonly totalCobradoHoy = computed(() => {
    return this.cobrosDelDia().reduce((sum, c) => sum + (c.monto || 0), 0);
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.actualizarReloj();
      this.timerSub = interval(1000).subscribe(() => this.actualizarReloj());
      this.autoRefreshSub = interval(15000).subscribe(() => this.refrescarTodo());
    }

    this.refrescarTodo();
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
    this.autoRefreshSub?.unsubscribe();
  }

  private actualizarReloj(): void {
    const ahora = new Date();
    this.horaActual.set(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  refrescarTodo(): void {
    this.cargando.set(true);
    this.ordersService.loadActiveOrders();
    this.paymentService.cargarPagos().subscribe();
    this.financeService.obtenerCajaActual();
    this.financeService.cargarMovimientos();
    this.cargarLiquidaciones();
    setTimeout(() => this.cargando.set(false), 800);
  }

  seleccionarOrdenParaCobro(orden: Order): void {
    this.ordenSeleccionada.set(orden);
    this.metodoCobroSeleccionado.set('EFECTIVO');
    this.efectivoRecibidoInput = orden.total;
    this.referenciaPagoInput = '';
  }

  cerrarModalCobro(): void {
    this.ordenSeleccionada.set(null);
  }

  sumarEfectivo(adicional: number): void {
    this.efectivoRecibidoInput = (this.efectivoRecibidoInput || 0) + adicional;
  }

  esCobroValido(): boolean {
    const orden = this.ordenSeleccionada();
    if (!orden) return false;

    if (this.metodoCobroSeleccionado() === 'EFECTIVO') {
      return (Number(this.efectivoRecibidoInput) || 0) >= orden.total;
    }
    return !!this.referenciaPagoInput.trim();
  }

  confirmarCobroComanda(): void {
    const orden = this.ordenSeleccionada();
    if (!orden || !this.esCobroValido()) return;

    this.procesandoAccion.set(true);
    const metodo = this.metodoCobroSeleccionado();
    const referencia = metodo === 'EFECTIVO' 
      ? `Efectivo en caja (Recibido S/ ${this.efectivoRecibidoInput.toFixed(2)}, Vuelto S/ ${this.vueltoCalculado().toFixed(2)})`
      : this.referenciaPagoInput.trim();

    // 1. ¿La orden ya tiene un pago? (el checkout del cliente crea uno PENDIENTE).
    //    El backend solo admite un pago por orden: crear otro devuelve 409.
    this.paymentService.obtenerPorOrden(orden.id).subscribe(existente => {
      if (existente?.estado === 'APROBADO') {
        this.procesandoAccion.set(false);
        this.notify.showInfo('Comanda ya cobrada', `La comanda #${orden.codigoSeguimiento || orden.id} ya tiene un pago aprobado.`);
        this.cerrarModalCobro();
        this.refrescarTodo();
        return;
      }
      if (existente?.estado === 'CANCELADO') {
        this.procesandoAccion.set(false);
        this.notify.showError('El pago de esta orden fue cancelado; no se puede cobrar.');
        return;
      }
      if (existente) {
        // Reutilizar el pago PENDIENTE existente
        this.confirmarYRegistrar(orden, Number(existente.id), metodo, referencia);
        return;
      }
      // 2. No hay pago: crearlo y confirmarlo
      this.paymentService.iniciarPago(orden.id, orden.total, metodo as any).subscribe({
        next: (tx) => this.confirmarYRegistrar(orden, Number(tx.id), metodo, referencia),
        error: (err) => {
          this.procesandoAccion.set(false);
          this.notify.showError(this.mensajeError(err, 'No se pudo iniciar la transacción de cobro'));
        }
      });
    });
  }

  private mensajeError(err: any, fallback: string): string {
    return err?.error?.detail || err?.error?.error || err?.error?.message || fallback;
  }

  private confirmarYRegistrar(orden: Order, pagoId: number, metodo: MetodoCobro, referencia: string): void {
        this.paymentService.confirmarPago(pagoId, referencia).subscribe({
          next: (confirmado) => {
            // confirmarPago devuelve null cuando el backend falla: no mostrar un falso éxito
            if (!confirmado) {
              this.procesandoAccion.set(false);
              this.notify.showError('No se pudo confirmar el cobro en el servicio de pagos');
              return;
            }
            // 3. Si es efectivo y la caja está abierta, registrar en movimientos de caja
            if (metodo === 'EFECTIVO' && this.cajaAbierta()) {
              this.financeService.registrarMovimiento({
                tipo: 'INGRESO',
                monto: orden.total,
                motivo: `Cobro Comanda #${orden.codigoSeguimiento || orden.id} (${orden.cliente.nombre})`
              }).subscribe();
            }

            // Registrar en historial local
            const cobroReg = {
              id: Date.now(),
              fechaHora: new Date().toISOString(),
              ordenId: orden.id,
              codigoOrden: orden.codigoSeguimiento || orden.id,
              clienteNombre: orden.cliente.nombre || 'Cliente General',
              tipoOrden: orden.tipo,
              metodo: metodo,
              monto: orden.total,
              referencia: referencia,
              items: orden.items,
              cajero: this.auth.currentUser()?.nombre || 'Cajero de Turno',
              efectivoRecibido: this.efectivoRecibidoInput,
              vuelto: this.vueltoCalculado()
            };
            // Generar Ticket
            this.ticketEmitido.set(cobroReg);
            this.notify.showSuccess(`Comanda #${orden.codigoSeguimiento || orden.id} cobrada exitosamente`);
            this.procesandoAccion.set(false);
            this.cerrarModalCobro();
            this.refrescarTodo();
          },
          error: (err) => {
            this.procesandoAccion.set(false);
            this.notify.showError(this.mensajeError(err, 'No se pudo confirmar el cobro en el servicio de pagos'));
          }
        });
  }

  imprimirTicket(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  reimprimirTicket(cobro: any): void {
    this.ticketEmitido.set(cobro);
  }

  // --- Operaciones de Caja ---
  ejecutarAperturaCaja(): void {
    if (this.montoAperturaInput < 0) {
      this.notify.showError('El monto de apertura no puede ser negativo');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.abrirCaja({
      montoApertura: this.montoAperturaInput,
      usuarioNombre: this.auth.currentUser()?.nombre || 'Cajero San Pollo',
      observaciones: this.observacionesAperturaInput || undefined
    }).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(err?.error?.error || 'No se pudo abrir la caja');
      }
    });
  }

  abrirModalMovimiento(): void {
    this.tipoMovimientoInput = 'EGRESO';
    this.montoMovimientoInput = 0;
    this.motivoMovimientoInput = '';
    this.mostrarModalMovimiento.set(true);
  }

  guardarMovimientoCaja(): void {
    if (this.montoMovimientoInput <= 0 || !this.motivoMovimientoInput.trim()) {
      this.notify.showError('Ingresa un monto válido y un motivo para el movimiento');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.registrarMovimiento({
      tipo: this.tipoMovimientoInput,
      monto: this.montoMovimientoInput,
      motivo: this.motivoMovimientoInput.trim()
    }).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.mostrarModalMovimiento.set(false);
      },
      error: () => {
        this.procesandoAccion.set(false);
        this.notify.showError('Error al registrar el movimiento en caja');
      }
    });
  }

  abrirModalCierre(): void {
    this.efectivoCierreInput = this.saldoTeoricoActual();
    this.posCierreInput = 0;
    this.digitalesCierreInput = 0;
    this.observacionesCierreInput = '';
    this.mostrarModalCierre.set(true);
  }

  ejecutarCierreCaja(): void {
    if (this.efectivoCierreInput < 0) {
      this.notify.showError('El efectivo contado no puede ser negativo');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.cerrarCaja({
      montoCierreEfectivo: this.efectivoCierreInput,
      montoCierrePos: this.posCierreInput,
      ventasDigitales: this.digitalesCierreInput,
      observaciones: this.observacionesCierreInput || undefined
    }).subscribe({
      next: (arqueoCerrado) => {
        this.procesandoAccion.set(false);
        this.mostrarModalCierre.set(false);
        this.notify.showSuccess(`Caja cerrada exitosamente. Cuadre: S/ ${arqueoCerrado.diferencia?.toFixed(2) || '0.00'}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(err?.error?.error || 'No se pudo realizar el cierre de caja');
      }
    });
  }

  // --- Métodos de Gestión Operativa: Llamadas, Liquidaciones y Mermas ---

  confirmarLlamadaPedido(o: Order): void {
    this.ordersService.confirmarLlamada(o.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Pedido #${o.codigoSeguimiento || o.id} confirmado`, 'Pasa directo a preparación en cocina.');
        // Emisión automática de comprobante Boleta en finance-service
        this.financeService.emitirComprobante({
          ordenId: Number(o.id),
          tipo: 'BOLETA',
          clienteNombre: o.cliente.nombre || 'Cliente General',
          clienteDireccion: o.cliente.direccion,
          total: o.total,
          pagadoDigitalmente: false,
          vueltoEstimado: o.vueltoEstimado
        }).subscribe();
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al confirmar llamada', err?.message);
      }
    });
  }

  intentoLlamadaPedido(o: Order): void {
    this.ordersService.registrarIntentoLlamada(o.id, 'Cliente no contesta llamada').subscribe({
      next: (actualizada) => {
        if (actualizada.estado === 'CANCELADO') {
          this.notify.showError(`Pedido #${o.codigoSeguimiento || o.id} cancelado`, 'Alcanzó el máximo de 2 intentos fallidos.');
        } else {
          this.notify.showInfo('Intento registrado', `Intentos: ${actualizada.intentosLlamada || 1} / 2`);
        }
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al registrar intento', err?.message);
      }
    });
  }

  cancelarPedidoContraPago(o: Order): void {
    const confirmar = confirm(`¿Cancelar el pedido #${o.codigoSeguimiento || o.id} por inasistencia del cliente?`);
    if (!confirmar) return;

    this.ordersService.updateOrderStatus(o.id, 'CANCELADO').subscribe({
      next: () => {
        this.notify.showInfo('Pedido cancelado', 'La comanda fue cancelada.');
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al cancelar pedido', err?.message);
      }
    });
  }

  cargarLiquidaciones(): void {
    this.financeService.listarLiquidacionesAbiertas().subscribe({
      next: (list) => this.liquidacionesAbiertas.set(list || [])
    });
  }

  ejecutarAperturaLiquidacion(): void {
    if (this.fondoInicialLiqInput < 0) {
      this.notify.showError('El fondo inicial no puede ser negativo');
      return;
    }

    this.financeService.abrirLiquidacion({
      repartidorId: this.repartidorIdLiqInput,
      repartidorNombre: this.repartidorNombreLiqInput,
      fondoInicial: this.fondoInicialLiqInput,
      observaciones: this.observacionesLiqInput || undefined
    }).subscribe({
      next: (liq) => {
        this.mostrarModalNuevaLiquidacion.set(false);
        this.notify.showSuccess(`Liquidación #${liq.id} aperturada para ${liq.repartidorNombre}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al aperturar liquidación', err?.error?.message || err?.message);
      }
    });
  }

  abrirModalCierreLiquidacion(liq: BackendLiquidacionResponse): void {
    this.liquidacionSeleccionada.set(liq);
    this.totalRendidoLiqInput = (liq.fondoInicial || 0) + (liq.totalCobradoEfectivo || 0);
    this.mostrarModalCierreLiquidacion.set(true);
  }

  confirmarCierreLiquidacion(): void {
    const liq = this.liquidacionSeleccionada();
    if (!liq) return;

    this.financeService.cerrarLiquidacion(liq.id, {
      totalRendido: this.totalRendidoLiqInput,
      totalCobradoEfectivo: liq.totalCobradoEfectivo,
      observaciones: 'Cuadre en caja de turno'
    }).subscribe({
      next: (cerrada) => {
        this.mostrarModalCierreLiquidacion.set(false);
        this.liquidacionSeleccionada.set(null);
        this.notify.showSuccess(`Liquidación #${cerrada.id} cerrada. Diferencia: S/ ${cerrada.diferencia.toFixed(2)} (${cerrada.estado})`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al cerrar liquidación', err?.error?.message || err?.message);
      }
    });
  }

  resolverProductoFantasma(o: Order, destino: 'VENTA_RAPIDA_SALON' | 'MERMA_JUSTIFICADA'): void {
    const tipo = o.tipo === 'RECOJO_EN_TIENDA' ? 'RECOJO' : 'DELIVERY';
    this.inventoryService.resolverProductoFantasma({
      ordenId: Number(o.id),
      ordenTipo: tipo,
      destino: destino,
      observaciones: `Resuelto por cajero: ${destino}`
    }).subscribe({
      next: () => {
        this.notify.showSuccess(`Destino registrado: ${destino === 'VENTA_RAPIDA_SALON' ? 'Reasignado a mostrador' : 'Merma Justificada'}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.notify.showError('Error al resolver producto', err?.message);
      }
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
