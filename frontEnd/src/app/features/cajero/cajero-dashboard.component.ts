import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { FinanceService } from '../../core/services/finance.service';
import { FacturacionSunatService } from '../../core/services/facturacion-sunat.service';
import { EnvioSunatResponse } from '../../core/api/facturacion-sunat-api.service';
import { parsePositiveIntId } from '../../core/utils/id';
import { BackendComprobanteResponse, BackendEfectivoPendienteLiquidacion, BackendLiquidacionResponse } from '../../core/models/api-contracts.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order } from '../../core/models/order.model';
import { TipoMovimiento } from '../../core/models/finance.model';
import { RepartidoresService } from '../../core/services/repartidores.service';
import { SalonService } from '../../core/services/salon.service';
import { CajeroTab, CapturaPendiente, EntregaRecojoEvent, MetodoCobro, RechazarCapturaEvent } from './models/cajero.models';
import { normalizarCodigoTicket } from './models/cajero-plazos.helpers';
import { PagoOrdenAdmin } from '../../core/models/payment.model';
import { CajeroCapturasTabComponent } from './components/cajero-capturas-tab.component';
import { CajeroRecojoTabComponent } from './components/cajero-recojo-tab.component';
import { CajeroSidebarComponent } from './components/cajero-sidebar.component';
import { CajeroTopbarComponent } from './components/cajero-topbar.component';
import { CajeroPosTabComponent } from './components/cajero-pos-tab.component';
import { CajeroArqueoTabComponent } from './components/cajero-arqueo-tab.component';
import { CajeroHistorialTabComponent } from './components/cajero-historial-tab.component';
import { CajeroLlamadasTabComponent } from './components/cajero-llamadas-tab.component';
import { CajeroLiquidacionesTabComponent } from './components/cajero-liquidaciones-tab.component';
import { CajeroDevolucionesTabComponent } from './components/cajero-devoluciones-tab.component';
import { CajeroCobroModalComponent } from './components/cajero-cobro-modal.component';
import { CajeroTicketModalComponent } from './components/cajero-ticket-modal.component';
import { CajeroMovimientoModalComponent } from './components/cajero-movimiento-modal.component';
import { CajeroCierreModalComponent } from './components/cajero-cierre-modal.component';
import { CajeroNuevaLiquidacionModalComponent } from './components/cajero-nueva-liquidacion-modal.component';
import { CajeroRecargaFondoModalComponent } from './components/cajero-recarga-fondo-modal.component';
import { CajeroCierreLiquidacionModalComponent } from './components/cajero-cierre-liquidacion-modal.component';
import { CajeroCobroRepartidorModalComponent } from './components/cajero-cobro-repartidor-modal.component';
import { CobroSalonFacade, ErrorCobro } from './services/cobro-salon.facade';
import { DatosFiscales, consumidorFinal, motivoDatosFiscalesInvalidos } from './models/datos-fiscales';
import { mensajeError } from '../../core/utils/api-error';
import { esMismoDiaLima, fechaHoyLima } from '../../core/utils/fecha-lima';
import { FeedbackService } from '../../core/services/feedback.service';
import { SecurityAuditService } from '../../core/services/security-audit.service';
import { IncidentCreateModalComponent } from '../admin/components/soporte/incident-create-modal.component';
import { IncidenteForm } from '../admin/models/admin-forms';

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
    CajeroCapturasTabComponent,
    CajeroRecojoTabComponent,
    CajeroLiquidacionesTabComponent,
    CajeroDevolucionesTabComponent,
    IncidentCreateModalComponent,
    CajeroCobroModalComponent,
    CajeroTicketModalComponent,
    CajeroMovimientoModalComponent,
    CajeroCierreModalComponent,
    CajeroNuevaLiquidacionModalComponent,
    CajeroRecargaFondoModalComponent,
    CajeroCierreLiquidacionModalComponent,
    CajeroCobroRepartidorModalComponent
  ],
  template: `
    <div class="min-h-screen bg-[#0d0e11] text-slate-100 font-sans selection:bg-polleria-gold selection:text-slate-900 flex flex-col md:flex-row">

      <!-- ================= SIDEBAR LATERAL CAJERO ================= -->
      <app-cajero-sidebar
        [activeTab]="activeTab()"
        (tabChange)="cambiarTab($event)"
        [cajaAbierta]="cajaAbierta()"
        [fondoApertura]="financeService.cajaActual()?.montoApertura || 0"
        [totalPorCobrar]="comandasPorCobrar().length"
        [totalLlamadas]="ordenesPendientesLlamada().length"
        [totalCapturas]="capturasPendientes().length"
        [totalRecojo]="ordenesRecojo().length"
        [totalLiquidaciones]="liquidacionesAbiertas().length"
        [totalCobros]="cobrosDelDia().length"
        [totalDevoluciones]="feedbackService.devolucionesPendientes().length"
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
              [totalPorCobrar]="comandasPorCobrar().length"
              [comandas]="comandasFiltradas()"
              [mesasPorCobrarMap]="mesasPorCobrarSet()"
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
              [enviosPorOrden]="facturacionSunat.enviosPorOrden()"
              [enviandoOrdenIds]="facturacionSunat.enviandoOrdenIds()"
              [comprobantesPorOrden]="comprobantesPorOrden()"
              (reimprimir)="reimprimirTicket($event)"
              (enviarSunat)="enviarOrdenASunat($event)"
              (verTicketSunat)="facturacionSunat.abrirTicketSunat($event)"
              (descargarXml)="facturacionSunat.descargarXml($event)"
              (descargarCdr)="facturacionSunat.descargarCdr($event)"
            />
          }

          @if (activeTab() === 'LLAMADAS_CONTRAPAGO') {
            <app-cajero-llamadas-tab
              [ordenes]="ordenesPendientesLlamada()"
              [now]="now()"
              [procesando]="procesandoAccion()"
              (confirmar)="confirmarLlamadaPedido($event)"
              (noContesta)="intentoLlamadaPedido($event)"
              (cancelar)="cancelarPedidoContraPago($event)"
            />
          }

          @if (activeTab() === 'CAPTURAS_PAGO') {
            <app-cajero-capturas-tab
              [capturas]="capturasPendientes()"
              [now]="now()"
              [procesando]="procesandoAccion()"
              [error]="errorCapturas()"
              (aprobar)="aprobarCaptura($event)"
              (rechazar)="rechazarCaptura($event)"
            />
          }

          @if (activeTab() === 'RECOJO_TIENDA') {
            <app-cajero-recojo-tab
              [ordenes]="ordenesRecojo()"
              [now]="now()"
              [procesando]="procesandoAccion()"
              (entregar)="entregarRecojo($event)"
              (fantasma)="declararFantasmaRecojo($event)"
            />
          }

          @if (activeTab() === 'LIQUIDACIONES') {
            <app-cajero-liquidaciones-tab
              [liquidaciones]="liquidacionesAbiertas()"
              (nuevaLiquidacion)="abrirModalNuevaLiquidacion()"
              (cobrarEfectivo)="abrirModalCobroRepartidor()"
              (recargarFondo)="abrirModalRecargaFondo($event)"
              (rendir)="abrirModalCierreLiquidacion($event)"
            />
          }

          @if (activeTab() === 'DEVOLUCIONES') {
            <app-cajero-devoluciones-tab
              [devoluciones]="feedbackService.devolucionesPendientes()"
              [procesando]="procesandoAccion()"
              (refresh)="feedbackService.cargarDevolucionesPendientes()"
              (entregar)="entregarDevolucion($event)"
            />
          }

        </div>

        <!-- Botón flotante: reportar incidente operativo -->
        <div class="fixed bottom-6 right-6 z-30">
          <button
            type="button"
            (click)="mostrarModalIncidente.set(true)"
            class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold shadow-2xl shadow-amber-900/40 backdrop-blur-sm border border-amber-500/50 transition cursor-pointer"
            title="Reportar incidente operativo"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>Incidente</span>
          </button>
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
          [cajaAbierta]="cajaAbierta()"
          [(datosFiscales)]="datosFiscalesCobro"
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
          [envioSunat]="envioSunatTicketActual()"
          [enviandoSunat]="enviandoTicketActual()"
          (imprimir)="imprimirTicket()"
          (cerrar)="ticketEmitido.set(null)"
          (enviarSunat)="enviarOrdenASunat($event)"
          (verTicketSunat)="facturacionSunat.abrirTicketSunat($event)"
          (descargarXml)="facturacionSunat.descargarXml($event)"
          (descargarCdr)="facturacionSunat.descargarCdr($event)"
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
          [(efectivo)]="efectivoCierreInput"
          [(pos)]="posCierreInput"
          [(digitales)]="digitalesCierreInput"
          [(observaciones)]="observacionesCierreInput"
          [error]="errorCierre()"
          [motivoObligatorio]="motivoCierreObligatorio()"
          [procesando]="procesandoAccion()"
          (cancelar)="mostrarModalCierre.set(false)"
          (confirmar)="ejecutarCierreCaja()"
        />
      }

      <!-- MODAL APERTURA LIQUIDACIÓN MOTORIZADO -->
      @if (mostrarModalNuevaLiquidacion()) {
        <app-cajero-nueva-liquidacion-modal
          [repartidores]="repartidoresService.repartidores()"
          [(repartidorId)]="repartidorIdLiqInput"
          [fondoSugerido]="fondoSugeridoNuevoRepartidor()"
          [(fondoInicial)]="fondoInicialLiqInput"
          [(observaciones)]="observacionesLiqInput"
          [procesando]="procesandoAccion()"
          (onRepartidorChange)="onRepartidorLiqChange($event)"
          (cancelar)="mostrarModalNuevaLiquidacion.set(false)"
          (aperturar)="ejecutarAperturaLiquidacion()"
        />
      }

      <!-- MODAL RECARGA DE FONDO A MOTORIZADO -->
      @if (mostrarModalRecargaFondo()) {
        <app-cajero-recarga-fondo-modal
          [liquidacion]="liquidacionRecargaSeleccionada()"
          [(monto)]="montoRecargaInput"
          [(motivo)]="motivoRecargaInput"
          [procesando]="procesandoAccion()"
          (cancelar)="mostrarModalRecargaFondo.set(false)"
          (confirmar)="ejecutarRecargaFondo()"
        />
      }

      <!-- MODAL CIERRE Y RENDICIÓN DE LIQUIDACIÓN -->
      @if (mostrarModalCierreLiquidacion()) {
        <app-cajero-cierre-liquidacion-modal
          [liquidacion]="liquidacionSeleccionada()"
          [pendiente]="pendienteLiq()"
          [cargandoPendiente]="cargandoPendienteLiq()"
          [errorPendiente]="errorPendienteLiq()"
          [procesando]="procesandoAccion()"
          [(totalRendido)]="totalRendidoLiqInput"
          (cancelar)="mostrarModalCierreLiquidacion.set(false)"
          (confirmar)="confirmarCierreLiquidacion()"
        />
      }

      <!-- MODAL COBRO DE EFECTIVO A MOTORIZADO -->
      @if (mostrarModalCobroRepartidor()) {
        <app-cajero-cobro-repartidor-modal
          [repartidores]="repartidoresService.repartidores()"
          [(repartidorId)]="repartidorIdCobroInput"
          (cancelar)="mostrarModalCobroRepartidor.set(false)"
          (cobroExitoso)="mostrarModalCobroRepartidor.set(false); refrescarTodo()"
        />
      }

      <!-- MODAL: DOCUMENTAR INCIDENTE OPERATIVO (CAJERO) -->
      @if (mostrarModalIncidente()) {
        <app-incident-create-modal
          [initial]="incidenteFormCajero"
          (closed)="mostrarModalIncidente.set(false)"
          (confirmed)="incidenteFormCajero = $event; confirmarIncidenteCajero()"
        />
      }

    </div>
  `
})
export class CajeroDashboardComponent implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly paymentService = inject(PaymentService);
  readonly financeService = inject(FinanceService);
  readonly facturacionSunat = inject(FacturacionSunatService);
  readonly repartidoresService = inject(RepartidoresService);
  readonly salonService = inject(SalonService);
  private notifiedMesas = new Set<string>();
  readonly feedbackService = inject(FeedbackService);
  readonly securityAuditService = inject(SecurityAuditService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private notify = inject(NotificationService);
  private readonly cobroSalon = inject(CobroSalonFacade);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  // Estados reactivos
  readonly activeTab = signal<CajeroTab>('POS');
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
  readonly datosFiscalesCobro = signal<DatosFiscales>(consumidorFinal());
  readonly comprobantesPorOrden = signal<Map<number, BackendComprobanteResponse> | null>(null);
  readonly envioSunatTicketActual = computed<EnvioSunatResponse | null>(() => {
    const t = this.ticketEmitido();
    const id = parsePositiveIntId(t?.comprobante?.ordenId ?? t?.ordenId);
    return id ? (this.facturacionSunat.enviosPorOrden().get(id) ?? null) : null;
  });
  readonly enviandoTicketActual = computed<boolean>(() => {
    const t = this.ticketEmitido();
    const id = parsePositiveIntId(t?.comprobante?.ordenId ?? t?.ordenId);
    return id ? this.facturacionSunat.estaEnviando(id) : false;
  });

  // Modales de Caja
  montoAperturaInput = 200;
  observacionesAperturaInput = '';
  readonly mostrarModalMovimiento = signal<boolean>(false);
  tipoMovimientoInput: TipoMovimiento = 'EGRESO';
  montoMovimientoInput = 0;
  motivoMovimientoInput = '';

  readonly mostrarModalCierre = signal<boolean>(false);
  /** Counted cash, typed blind by the cashier (never pre-filled with the expected amount). */
  efectivoCierreInput: number | null = null;
  posCierreInput = 0;
  digitalesCierreInput = 0;
  observacionesCierreInput = '';
  /** Backend message of the last rejected close (e.g. 400 for an unexplained difference). */
  readonly errorCierre = signal<string | null>(null);
  readonly motivoCierreObligatorio = signal<boolean>(false);

  // --- Módulos Operativos Nuevos: Llamadas y Liquidaciones ---
  readonly ordenesPendientesLlamada = computed(() =>
    this.ordersService.orders().filter(o => o.estado === 'PENDIENTE_CONFIRMACION')
  );

  /** Clock for the 15 min / 1 h countdowns, ticking with the header clock. */
  readonly now = signal<number>(Date.now());

  /** Payments with an uploaded capture, from the payments-service inbox (never cached locally). */
  readonly pagosPorVerificar = signal<PagoOrdenAdmin[]>([]);
  readonly errorCapturas = signal<string | null>(null);

  /**
   * PENDIENTE_PAGO orders joined with their capture; an order without capture keeps `pago: null`.
   * Only WhatsApp orders (they pay by capture) or orders that already uploaded one belong here:
   * a web order waiting for Mercado Pago / Yape OTP is paid by the gateway, not by the cashier.
   */
  readonly capturasPendientes = computed<CapturaPendiente[]>(() => {
    const pagos = new Map(this.pagosPorVerificar().map(p => [String(p.ordenId), p]));
    return this.ordersService.orders()
      .filter(o => o.estado === 'PENDIENTE_PAGO')
      .map(orden => ({ orden, pago: pagos.get(String(orden.id).replace(/^ord-/, '')) ?? null }))
      .filter(({ orden, pago }) => orden.canalOrigen === 'WHATSAPP' || !!pago?.comprobanteUrl);
  });

  /** Pickup orders ready in store (backend LISTO_PARA_ENTREGAR). */
  readonly ordenesRecojo = computed(() =>
    this.ordersService.orders().filter(o => o.tipo === 'RECOJO_EN_TIENDA' && o.estado === 'LISTO_COCINA')
  );

  readonly liquidacionesAbiertas = signal<BackendLiquidacionResponse[]>([]);
  readonly mostrarModalNuevaLiquidacion = signal<boolean>(false);
  readonly mostrarModalRecargaFondo = signal<boolean>(false);
  readonly mostrarModalCierreLiquidacion = signal<boolean>(false);
  readonly mostrarModalCobroRepartidor = signal<boolean>(false);
  readonly liquidacionSeleccionada = signal<BackendLiquidacionResponse | null>(null);
  readonly liquidacionRecargaSeleccionada = signal<BackendLiquidacionResponse | null>(null);

  repartidorIdLiqInput: number | null = null;
  repartidorIdCobroInput: number | null = null;
  fondoInicialLiqInput = 50.0;
  montoRecargaInput = 20;
  motivoRecargaInput = '';
  totalRendidoLiqInput: number | null = null;
  readonly pendienteLiq = signal<BackendEfectivoPendienteLiquidacion | null>(null);
  readonly cargandoPendienteLiq = signal<boolean>(false);
  readonly errorPendienteLiq = signal<string | null>(null);
  observacionesLiqInput = '';

  readonly fondoSugeridoNuevoRepartidor = computed(() => {
    const repId = this.repartidorIdLiqInput;
    if (!repId) return 0;
    return this.ordersService.orders()
      .filter(o => o.tipo === 'DELIVERY' && o.repartidorId === repId && o.requiereCobroEfectivo && !['COMPLETADO', 'CANCELADO', 'PEDIDO_FANTASMA'].includes(o.estado))
      .reduce((acc, o) => acc + (o.vueltoEstimado || 0), 0);
  });

  // Registro combinado de cobros aprobados de hoy (America/Lima) desde el microservicio de pagos (FE-03)
  readonly cobrosDelDia = computed(() => {
    const ordersMap = new Map(this.ordersService.orders().map(o => [String(o.id), o]));
    const pagosAprobados = this.paymentService.pagos().filter(
      p => p.estado === 'APROBADO' && esMismoDiaLima(p.fechaTransaccion)
    );
    return pagosAprobados.map(p => {
      const o = ordersMap.get(String(p.orderId));
      return {
        id: p.id,
        fechaHora: p.fechaTransaccion,
        ordenId: p.orderId,
        codigoOrden: o?.codigoSeguimiento ? String(o.codigoSeguimiento).replace(/^POL-?/, '') : String(p.orderId),
        clienteNombre: o?.cliente?.nombre || '',
        tipoOrden: o?.tipo || '',
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.numeroOperacion || 'Cobro aprobado',
        items: o?.items || [],
        cajero: this.auth.currentUser()?.nombre || ''
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
  /**
   * What the cashier collects at the POS: dine-in (SALON) orders. Delivery is paid online or
   * collected by the courier, pickup is collected at «Recojo en tienda» against its ticket, and an
   * order still waiting for its payment or phone call is not payable yet. Offering them here gave a
   * second collection path without ticket or courier.
   */
  readonly comandasPorCobrar = computed(() => {
    const pagosMap = this.paymentService.pagosPorOrdenMap();
    const mesasMap = new Map<number, string>(this.salonService.mesas().map(m => [Number(m.numero), m.estado]));
    const mesasIdMap = new Map<number, string>(this.salonService.mesas().map(m => [Number(m.id), m.estado]));

    const filtradas = this.ordersService.orders().filter(o => {
      if (o.tipo !== 'SALON') return false;
      if (['CANCELADO', 'COMPLETADO', 'PEDIDO_FANTASMA'].includes(o.estado)) return false;
      // D3.14: only tables that asked for the bill; orders-service rejects closing any other one.
      // Without mesaEstado (older backend) the previous behavior stays.
      if (o.mesaEstado && o.mesaEstado !== 'POR_COBRAR') return false;
      const pago = pagosMap.get(String(o.id));
      return !pago || pago.estado !== 'APROBADO';
    });

    // Priorizar al inicio (posición 1) las mesas que están en estado POR_COBRAR
    return [...filtradas].sort((a, b) => {
      const aMesaNum = a.cliente?.mesaNumero ? Number(a.cliente.mesaNumero) : 0;
      const bMesaNum = b.cliente?.mesaNumero ? Number(b.cliente.mesaNumero) : 0;
      const aMesaId = (a as any).mesaId ? Number((a as any).mesaId) : 0;
      const bMesaId = (b as any).mesaId ? Number((b as any).mesaId) : 0;

      const aPorCobrar = mesasMap.get(aMesaNum) === 'POR_COBRAR' || mesasIdMap.get(aMesaId) === 'POR_COBRAR';
      const bPorCobrar = mesasMap.get(bMesaNum) === 'POR_COBRAR' || mesasIdMap.get(bMesaId) === 'POR_COBRAR';

      if (aPorCobrar && !bPorCobrar) return -1;
      if (!aPorCobrar && bPorCobrar) return 1;
      return 0;
    });
  });

  readonly comandasFiltradas = computed(() => {
    let list = this.comandasPorCobrar();

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

  readonly mesasPorCobrarSet = computed(() => {
    const set = new Set<string>();
    for (const m of this.salonService.mesas()) {
      if (m.estado === 'POR_COBRAR') {
        set.add(`num-${m.numero}`);
        set.add(`id-${m.id}`);
      }
    }
    return set;
  });
  // Método (no computed): efectivoRecibidoInput es un campo plano enlazado con ngModel,
  // un computed() no detecta sus cambios y el vuelto se quedaba congelado en 0.
  vueltoCalculado(): number {
    const total = this.ordenSeleccionada()?.total || 0;
    const recibido = Number(this.efectivoRecibidoInput) || 0;
    return Math.max(0, Math.round((recibido - total) * 100) / 100);
  }

  readonly totalCobradoHoy = computed(() => {
    return this.cobrosDelDia().reduce((sum, c) => sum + (c.monto || 0), 0);
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.actualizarReloj();
      this.timerSub = interval(1000).subscribe(() => this.actualizarReloj());
      this.autoRefreshSub = interval(15000).subscribe(() => this.refrescarTodo());
      this.completarRetornoMercadoPagoSiAplica();
    }

    this.refrescarTodo();
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
    this.autoRefreshSub?.unsubscribe();
  }

  private actualizarReloj(): void {
    const ahora = new Date();
    this.now.set(ahora.getTime());
    this.horaActual.set(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  refrescarTodo(): void {
    this.cargando.set(true);
    this.ordersService.loadActiveOrders();
    this.salonService.cargarMesas();
    this.paymentService.cargarPagos({ fecha: fechaHoyLima(), limit: 200 }).subscribe();
    this.financeService.obtenerCajaActual();
    this.financeService.cargarMovimientos();
    this.cargarLiquidaciones();
    this.cargarCapturas();
    this.verificarAlertasMesasPorCobrar();
    this.feedbackService.cargarDevolucionesPendientes();
    if (this.activeTab() === 'HISTORIAL') {
      this.cargarDatosSunatHistorial();
    }
    setTimeout(() => this.cargando.set(false), 800);
  }

  private verificarAlertasMesasPorCobrar(): void {
    const mesasMap = new Map<number, string>(this.salonService.mesas().map(m => [Number(m.numero), m.estado]));
    const comandas = this.comandasPorCobrar();

    for (const orden of comandas) {
      const numMesa = orden.cliente?.mesaNumero ? Number(orden.cliente.mesaNumero) : 0;
      if (numMesa > 0 && mesasMap.get(numMesa) === 'POR_COBRAR') {
        const key = `${orden.id}-${numMesa}`;
        if (!this.notifiedMesas.has(key)) {
          this.notifiedMesas.add(key);
          this.notify.showInfo(
            `🔔 ¡Mesa ${numMesa} solicita la cuenta!`,
            `Comanda #${orden.codigoSeguimiento || orden.id} — Total: S/ ${orden.total.toFixed(2)}`
          );
        }
      }
    }
  }

  seleccionarOrdenParaCobro(orden: Order): void {
    this.ordenSeleccionada.set(orden);
    // Without an open register cash is blocked (R3.7): start on Mercado Pago so the cashier is not stuck.
    this.metodoCobroSeleccionado.set(this.cajaAbierta() ? 'EFECTIVO' : 'MERCADO_PAGO');
    this.datosFiscalesCobro.set(consumidorFinal());
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
    if (motivoDatosFiscalesInvalidos(this.datosFiscalesCobro(), orden.total)) return false;

    if (this.metodoCobroSeleccionado() === 'EFECTIVO') {
      if (!this.cajaAbierta()) return false;
      return (Number(this.efectivoRecibidoInput) || 0) >= orden.total;
    }
    return true;
  }

  confirmarCobroComanda(): void {
    const orden = this.ordenSeleccionada();
    if (!orden || !this.esCobroValido()) return;

    this.procesandoAccion.set(true);
    const metodo = this.metodoCobroSeleccionado();
    const datosFiscales = this.datosFiscalesCobro();

    if (metodo === 'MERCADO_PAGO') {
      const codigo = orden.codigoSeguimiento || orden.id;
      this.cobroSalon.iniciarMercadoPago(orden).subscribe({
        next: (res) => {
          if (res.yaAprobado) {
            this.ejecutarCobroSalon(orden, 'MERCADO_PAGO', 'Mercado Pago', datosFiscales, 0, 0);
            return;
          }
          if (res.checkoutUrl && isPlatformBrowser(this.platformId)) {
            try {
              localStorage.setItem('sanpollo_cajero_cobro', JSON.stringify({ ordenId: orden.id, datosFiscales }));
              localStorage.setItem('sanpollo_last_order', JSON.stringify({
                ordenId: orden.id,
                pagoId: res.pagoId,
                code: codigo,
                codigo,
                total: orden.total,
                estado: orden.estado
              }));
            } catch {
              // Storage unavailable; webhook/return still verifies payment on backend.
            }
            this.notify.showSuccess('Redirigiendo a Mercado Pago...');
            setTimeout(() => {
              window.location.href = res.checkoutUrl!;
            }, 300);
            return;
          }
          this.procesandoAccion.set(false);
          this.notify.showError('Mercado Pago no devolvió el enlace de pago', 'Intenta nuevamente o cobra en efectivo.');
        },
        error: (err: ErrorCobro) => {
          this.procesandoAccion.set(false);
          this.notify.showError(err?.mensaje || 'No se pudo iniciar el pago con Mercado Pago');
        }
      });
      return;
    }

    const efectivoRecibido = this.efectivoRecibidoInput;
    const vuelto = this.vueltoCalculado();
    const referencia = `Efectivo en caja (Recibido S/ ${efectivoRecibido.toFixed(2)}, Vuelto S/ ${vuelto.toFixed(2)})`;
    this.ejecutarCobroSalon(orden, metodo, referencia, datosFiscales, efectivoRecibido, vuelto);
  }

  private ejecutarCobroSalon(
    orden: Order,
    metodo: MetodoCobro,
    referencia: string,
    datosFiscales: DatosFiscales,
    efectivoRecibido: number,
    vuelto: number
  ): void {
    const codigo = orden.codigoSeguimiento || orden.id;

    // Plan 03, 4.1: payment, then receipt + cash income, then closing; retry-safe (D3.17).
    this.cobroSalon.cobrar(orden, metodo, referencia, datosFiscales).subscribe({
      next: ({ comprobante }) => {
        this.ticketEmitido.set({
          id: Date.now(),
          fechaHora: new Date().toISOString(),
          ordenId: orden.id,
          codigoOrden: codigo,
          cliente: orden.cliente.nombre || 'Cliente General',
          clienteNombre: orden.cliente.nombre || 'Cliente General',
          tipo: orden.tipo,
          tipoOrden: orden.tipo,
          metodo,
          total: comprobante?.total ?? orden.total,
          monto: comprobante?.total ?? orden.total,
          referencia,
          items: orden.items,
          cajero: this.auth.currentUser()?.nombre || 'Cajero de Turno',
          efectivoRecibido,
          vuelto,
          comprobante
        });
        this.notify.showSuccess(`Comanda #${codigo} cobrada`, `Comprobante ${comprobante?.serieCorrelativo ?? ''}`.trim());
        this.procesandoAccion.set(false);
        this.cerrarModalCobro();
        this.refrescarTodo();
      },
      error: (err: ErrorCobro) => {
        this.procesandoAccion.set(false);
        if (err?.pagoAprobado) {
          // The money is taken: never offer to charge again, only to finish what is missing.
          const pendiente = err.paso === 'CIERRE' ? 'cierre de la comanda pendiente' : 'comprobante pendiente';
          this.notify.showError(`Pago OK, ${pendiente}`,
            `La comanda #${codigo} ya está cobrada. ${err.mensaje} Vuelve a confirmar para completar sin cobrar de nuevo.`);
        } else {
          this.notify.showError(err?.mensaje || 'No se pudo registrar el cobro');
        }
        this.refrescarTodo();
      }
    });
  }

  private completarRetornoMercadoPagoSiAplica(): void {
    const mpOrdenId = this.route.snapshot?.queryParamMap?.get('mpOrdenId');
    let savedRaw: string | null = null;
    try {
      savedRaw = window.localStorage?.getItem('sanpollo_cajero_cobro') ?? null;
    } catch {
      return;
    }
    if (!mpOrdenId && !savedRaw) return;

    let ordenId = mpOrdenId || '';
    let datosFiscales = consumidorFinal();
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (!ordenId && parsed?.ordenId) ordenId = String(parsed.ordenId);
        if (parsed?.datosFiscales) datosFiscales = parsed.datosFiscales;
        window.localStorage.removeItem('sanpollo_cajero_cobro');
      } catch {
        window.localStorage.removeItem('sanpollo_cajero_cobro');
      }
    }
    if (!ordenId) return;

    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    this.procesandoAccion.set(true);
    this.ordersService.obtenerOrden(ordenId).subscribe({
      next: (orden) => {
        this.ejecutarCobroSalon(orden, 'MERCADO_PAGO', 'Mercado Pago', datosFiscales, 0, 0);
      },
      error: () => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo cargar la comanda tras el pago en Mercado Pago');
      }
    });
  }

  imprimirTicket(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  reimprimirTicket(cobro: any): void {
    this.financeService.obtenerComprobantePorOrden(cobro.ordenId).subscribe({
      next: (comprobante) => {
        this.ticketEmitido.set({ ...cobro, comprobante });
        this.facturacionSunat.consultarEstadoOrden(cobro.ordenId).subscribe();
      },
      error: () => this.ticketEmitido.set({ ...cobro, comprobante: null })
    });
  }

  cambiarTab(tab: CajeroTab): void {
    this.activeTab.set(tab);
    if (tab === 'HISTORIAL') {
      this.cargarDatosSunatHistorial();
    }
  }

  private cargarDatosSunatHistorial(): void {
    this.facturacionSunat.cargarEnvios();
    this.financeService.listarComprobantes().subscribe({
      next: (lista) => {
        const mapa = new Map<number, BackendComprobanteResponse>();
        for (const c of lista) {
          mapa.set(c.ordenId, c);
        }
        this.comprobantesPorOrden.set(mapa);
      },
      error: () => {}
    });
  }

  enviarOrdenASunat(ordenId: number): void {
    this.facturacionSunat.enviarASunat(ordenId).subscribe({ error: () => {} });
  }

  // --- Operaciones de Caja ---
  ejecutarAperturaCaja(): void {
    const monto = Number(this.montoAperturaInput);
    if (
      this.montoAperturaInput === null ||
      this.montoAperturaInput === undefined ||
      !Number.isFinite(monto) ||
      monto < 0
    ) {
      this.notify.showError('Ingresa un monto de apertura válido mayor o igual a 0');
      return;
    }
    if (this.procesandoAccion()) return;

    this.procesandoAccion.set(true);
    this.financeService.abrirCaja({
      montoApertura: monto,
      usuarioNombre: this.auth.currentUser()?.nombre || 'Cajero San Pollo',
      observaciones: this.observacionesAperturaInput || undefined
    }).subscribe({
      next: (caja) => {
        this.procesandoAccion.set(false);
        this.notify.showSuccess(`Caja #${caja.id} abierta con fondo de S/ ${caja.montoApertura.toFixed(2)}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(mensajeError(err, 'No se pudo abrir la caja'));
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
    const monto = Number(this.montoMovimientoInput);
    if (!Number.isFinite(monto) || monto <= 0 || !this.motivoMovimientoInput.trim()) {
      this.notify.showError('Ingresa un monto válido y un motivo para el movimiento');
      return;
    }
    if (this.procesandoAccion()) return;

    this.procesandoAccion.set(true);
    this.financeService.registrarMovimiento({
      tipo: this.tipoMovimientoInput,
      monto,
      motivo: this.motivoMovimientoInput.trim()
    }).subscribe({
      next: (mov) => {
        this.procesandoAccion.set(false);
        this.mostrarModalMovimiento.set(false);
        this.notify.showSuccess(`Movimiento de ${mov.tipo} registrado por S/ ${mov.monto.toFixed(2)}`);
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError(mensajeError(err, 'Error al registrar el movimiento en caja'));
      }
    });
  }

  abrirModalCierre(): void {
    this.efectivoCierreInput = null;
    this.posCierreInput = 0;
    this.digitalesCierreInput = 0;
    this.observacionesCierreInput = '';
    this.errorCierre.set(null);
    this.motivoCierreObligatorio.set(false);
    this.mostrarModalCierre.set(true);
  }

  ejecutarCierreCaja(): void {
    const efectivo = this.efectivoCierreInput;
    if (efectivo === null || efectivo === undefined || `${efectivo}` === '' || !Number.isFinite(Number(efectivo))) {
      this.notify.showError('Ingresa el efectivo contado en gaveta');
      return;
    }
    if (Number(efectivo) < 0) {
      this.notify.showError('El efectivo contado no puede ser negativo');
      return;
    }
    if (this.procesandoAccion()) return;
    const observaciones = this.observacionesCierreInput?.trim();
    if (this.motivoCierreObligatorio() && !observaciones) {
      this.notify.showError('Indica el motivo de la diferencia en las observaciones');
      return;
    }

    this.procesandoAccion.set(true);
    this.errorCierre.set(null);
    this.financeService.cerrarCaja({
      montoCierreEfectivo: efectivo,
      montoCierrePos: this.posCierreInput,
      ventasDigitales: this.digitalesCierreInput,
      observaciones: observaciones || undefined
    }).subscribe({
      next: (arqueoCerrado) => {
        this.procesandoAccion.set(false);
        this.mostrarModalCierre.set(false);
        this.motivoCierreObligatorio.set(false);
        // The expected amount is revealed only after the blind count was confirmed.
        this.notify.showSuccess(
          `Caja cerrada. Esperado: S/ ${(arqueoCerrado.totalEsperado ?? 0).toFixed(2)} · Diferencia: S/ ${(arqueoCerrado.diferencia ?? 0).toFixed(2)}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        const mensaje = mensajeError(err, 'No se pudo realizar el cierre de caja');
        this.errorCierre.set(mensaje);
        if (err?.status === 400) {
          this.motivoCierreObligatorio.set(true);
        } else {
          this.notify.showError(mensaje);
        }
      }
    });
  }

  // --- Métodos de Gestión Operativa: Llamadas y Liquidaciones ---

  confirmarLlamadaPedido(o: Order): void {
    const codigo = o.codigoSeguimiento || o.id;
    this.procesandoAccion.set(true);
    this.ordersService.confirmarLlamada(o.id).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showSuccess(`Pedido #${codigo} confirmado`, 'Pasa a la cola de cocina: cocina lo inicia.');
        // The cash receipt (boleta) is issued in finance-service; if it fails the cashier must know.
        this.financeService.emitirComprobante({
          ordenId: Number(o.id),
          tipo: 'BOLETA',
          clienteNombre: o.cliente.nombre || 'Cliente General',
          clienteDireccion: o.cliente.direccion,
          total: o.total,
          pagadoDigitalmente: false,
          vueltoEstimado: o.vueltoEstimado
        }).subscribe({
          error: (err) => this.notify.showError('No se emitió la boleta',
            `El pedido #${codigo} sí quedó confirmado. ${mensajeError(err, 'Emítela desde Arqueo.')}`.trim())
        });
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo confirmar la llamada', mensajeError(err, 'Intenta nuevamente.'));
        this.refrescarTodo();
      }
    });
  }

  intentoLlamadaPedido(o: Order): void {
    this.procesandoAccion.set(true);
    this.ordersService.registrarIntentoLlamada(o.id, 'Cliente no contesta llamada').subscribe({
      next: (actualizada) => {
        this.procesandoAccion.set(false);
        if (actualizada.estado === 'CANCELADO') {
          this.notify.showError(`Pedido #${o.codigoSeguimiento || o.id} cancelado`, 'Alcanzó el máximo de 2 intentos fallidos.');
        } else {
          this.notify.showInfo('Intento registrado', `Intentos: ${actualizada.intentosLlamada || 1} / 2`);
        }
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo registrar el intento', mensajeError(err, 'Intenta nuevamente.'));
        this.refrescarTodo();
      }
    });
  }

  cancelarPedidoContraPago(o: Order): void {
    const confirmar = confirm(`¿Cancelar el pedido #${o.codigoSeguimiento || o.id} por inasistencia del cliente?`);
    if (!confirmar) return;

    this.procesandoAccion.set(true);
    this.ordersService.updateOrderStatus(o.id, 'CANCELADO').subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showInfo('Pedido cancelado', `El pedido #${o.codigoSeguimiento || o.id} fue cancelado.`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo cancelar el pedido', mensajeError(err, 'Intenta nuevamente.'));
        this.refrescarTodo();
      }
    });
  }

  cargarCapturas(): void {
    this.paymentService.listarPendientesVerificacion().subscribe({
      next: (pagos) => {
        this.pagosPorVerificar.set(pagos || []);
        this.errorCapturas.set(null);
      },
      error: (err: Error) => this.errorCapturas.set(err.message)
    });
  }

  /** Approves the capture in payments-service; the order enters the kitchen queue only on the backend answer. */
  aprobarCaptura(pago: PagoOrdenAdmin): void {
    this.procesandoAccion.set(true);
    this.paymentService.verificarComprobante(pago.id, true).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showSuccess(`Pago de la orden #${pago.ordenId} confirmado`, 'El pedido pasa a la cola de cocina.');
        this.refrescarTodo();
      },
      error: (err: Error) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo confirmar el pago', err.message);
        this.refrescarTodo();
      }
    });
  }

  rechazarCaptura(event: RechazarCapturaEvent): void {
    this.procesandoAccion.set(true);
    this.paymentService.verificarComprobante(event.pago.id, false, event.motivo).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showInfo('Captura rechazada', `Se notificó al cliente de la orden #${event.pago.ordenId}.`);
        this.refrescarTodo();
      },
      error: (err: Error) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo rechazar la captura', err.message);
      }
    });
  }

  /**
   * Pickup hand-over: the ticket must match the order code POL-<id> (the per-customer number is not
   * accepted, it repeats across customers). ContraPago orders register the cash in payments-service,
   * which moves the order to ENTREGADO; paid orders go straight to ENTREGADO. Both send the ticket,
   * which the backend checks again.
   */
  entregarRecojo(event: EntregaRecojoEvent): void {
    const { orden } = event;
    const esperado = normalizarCodigoTicket(String(orden.id).replace(/^ord-/, ''));
    const recibido = normalizarCodigoTicket(event.codigoTicket);
    if (!recibido || recibido !== esperado) {
      this.notify.showError('Ticket no coincide', `El código no corresponde al pedido #${orden.codigoSeguimiento || orden.id}.`);
      return;
    }

    this.procesandoAccion.set(true);
    const codigo = orden.codigoSeguimiento || orden.id;
    const codigoTicket = `POL-${recibido}`;
    if (orden.requiereCobroEfectivo) {
      const efectivo = Number(event.efectivoRecibido) || 0;
      const vuelto = Math.max(0, Math.round((efectivo - orden.total) * 100) / 100);
      this.paymentService.registrarCobroEfectivo(orden.id, orden.total, efectivo, vuelto, codigoTicket).subscribe({
        next: () => {
          this.financeService.registrarVentaEnCaja(
            orden.id,
            {
              tipo: 'BOLETA',
              nombre: orden.cliente.nombre || 'Cliente General',
              direccion: orden.cliente.direccion
            },
            true
          ).subscribe({
            // El cobro en efectivo ya quedó aprobado: si falla el registro contable/comprobante, avisa al cajero.
            error: (err) => this.notify.showError(
              'No se registró el ingreso en caja',
              `El cobro del pedido #${codigo} sí se registró. Registra el ingreso de S/ ${orden.total.toFixed(2)} manualmente en caja. ${mensajeError(err, err?.message || '')}`.trim()
            )
          });
          this.procesandoAccion.set(false);
          this.notify.showSuccess(`Pedido #${codigo} cobrado y entregado`, `Vuelto: S/ ${vuelto.toFixed(2)}`);
          this.refrescarTodo();
        },
        error: (err) => {
          this.procesandoAccion.set(false);
          this.notify.showError('No se pudo registrar el cobro en efectivo', mensajeError(err, err?.message || ''));
        }
      });
      return;
    }

    this.ordersService.updateOrderStatus(orden.id, 'COMPLETADO', undefined, codigoTicket).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showSuccess(`Pedido #${codigo} entregado`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo entregar el pedido', mensajeError(err, err?.message || ''));
      }
    });
  }

  /** The backend rejects the declaration before 1 hour in store; the UI only offers it after the timer. */
  declararFantasmaRecojo(orden: Order): void {
    if (!confirm(`¿Declarar el pedido #${orden.codigoSeguimiento || orden.id} como PEDIDO FANTASMA? El cliente quedará bloqueado para ContraPago.`)) return;
    this.procesandoAccion.set(true);
    this.ordersService.declararPedidoFantasma(orden.id, 'NO_RECOGIDO: Cliente no recogió en 1 hora').subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.notify.showInfo('Pedido fantasma registrado', 'El cliente queda bloqueado para pago contra entrega.');
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo declarar el pedido fantasma', mensajeError(err, err?.message || ''));
      }
    });
  }

  cargarLiquidaciones(): void {
    this.financeService.listarLiquidacionesAbiertas().subscribe({
      next: (list) => this.liquidacionesAbiertas.set(list || [])
    });
  }

  abrirModalNuevaLiquidacion(): void {
    this.repartidorIdLiqInput = null;
    this.repartidoresService.cargar();
    this.mostrarModalNuevaLiquidacion.set(true);
  }

  onRepartidorLiqChange(repId: number | null): void {
    this.repartidorIdLiqInput = repId;
    const sugerido = this.fondoSugeridoNuevoRepartidor();
    if (sugerido > 0) {
      this.fondoInicialLiqInput = sugerido;
    }
  }

  abrirModalRecargaFondo(liq: BackendLiquidacionResponse): void {
    this.liquidacionRecargaSeleccionada.set(liq);
    this.montoRecargaInput = 20;
    this.motivoRecargaInput = '';
    this.mostrarModalRecargaFondo.set(true);
  }

  ejecutarRecargaFondo(): void {
    const liq = this.liquidacionRecargaSeleccionada();
    if (!liq || this.procesandoAccion()) return;
    const monto = Number(this.montoRecargaInput);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.notify.showError('El monto a recargar debe ser mayor a 0');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.recargarFondoLiquidacion(liq.id, monto, this.motivoRecargaInput).subscribe({
      next: (actualizada) => {
        this.procesandoAccion.set(false);
        this.mostrarModalRecargaFondo.set(false);
        this.liquidacionRecargaSeleccionada.set(null);
        this.notify.showSuccess(`Fondo recargado a S/ ${actualizada.fondoInicial.toFixed(2)} para ${actualizada.repartidorNombre}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('Error al recargar fondo', mensajeError(err, err?.message || 'No se pudo recargar el fondo.'));
      }
    });
  }

  abrirModalCobroRepartidor(repartidorId?: number): void {
    this.repartidorIdCobroInput = repartidorId ?? null;
    this.repartidoresService.cargar();
    this.mostrarModalCobroRepartidor.set(true);
  }

  ejecutarAperturaLiquidacion(): void {
    if (this.procesandoAccion()) return;
    const repartidor = this.repartidoresService.repartidores().find(r => r.id === this.repartidorIdLiqInput);
    if (!repartidor) {
      this.notify.showError('Selecciona un repartidor');
      return;
    }
    const fondo = Number(this.fondoInicialLiqInput);
    if (
      this.fondoInicialLiqInput === null ||
      this.fondoInicialLiqInput === undefined ||
      !Number.isFinite(fondo) ||
      fondo < 0
    ) {
      this.notify.showError('Ingresa un fondo inicial válido mayor o igual a 0');
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.abrirLiquidacion({
      repartidorId: repartidor.id,
      repartidorNombre: repartidor.nombre,
      fondoInicial: fondo,
      observaciones: this.observacionesLiqInput || undefined
    }).subscribe({
      next: (liq) => {
        this.procesandoAccion.set(false);
        this.mostrarModalNuevaLiquidacion.set(false);
        this.notify.showSuccess(`Liquidación #${liq.id} aperturada para ${liq.repartidorNombre}`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('Error al aperturar liquidación', mensajeError(err, err?.message || 'No se pudo aperturar la liquidación.'));
      }
    });
  }

  abrirModalCierreLiquidacion(liq: BackendLiquidacionResponse): void {
    this.liquidacionSeleccionada.set(liq);
    this.totalRendidoLiqInput = null;
    this.pendienteLiq.set(null);
    this.errorPendienteLiq.set(null);
    this.cargandoPendienteLiq.set(true);
    this.mostrarModalCierreLiquidacion.set(true);

    // The amount to hand in comes from the backend: fondo inicial + cash payments collected on route.
    this.financeService.obtenerEfectivoPendienteLiquidacion(liq.repartidorId).subscribe({
      next: (pendiente) => {
        this.pendienteLiq.set(pendiente);
        this.totalRendidoLiqInput = Math.round(((liq.fondoInicial || 0) + (Number(pendiente.total) || 0)) * 100) / 100;
        this.cargandoPendienteLiq.set(false);
      },
      error: (err) => {
        this.errorPendienteLiq.set(mensajeError(err, 'No se pudo consultar el efectivo pendiente del repartidor.'));
        this.cargandoPendienteLiq.set(false);
      }
    });
  }

  confirmarCierreLiquidacion(): void {
    if (this.procesandoAccion()) return;
    const liq = this.liquidacionSeleccionada();
    const totalRendido = this.totalRendidoLiqInput;
    if (
      !liq ||
      totalRendido === null ||
      totalRendido === undefined ||
      !Number.isFinite(Number(totalRendido)) ||
      Number(totalRendido) < 0 ||
      !this.pendienteLiq()
    ) {
      return;
    }

    this.procesandoAccion.set(true);
    this.financeService.cerrarLiquidacion(liq.id, {
      totalRendido: Number(totalRendido),
      totalCobradoEfectivo: liq.totalCobradoEfectivo,
      observaciones: 'Cuadre en caja de turno'
    }).subscribe({
      next: (cerrada) => {
        this.procesandoAccion.set(false);
        this.mostrarModalCierreLiquidacion.set(false);
        this.liquidacionSeleccionada.set(null);
        this.notify.showSuccess(`Liquidación #${cerrada.id} cerrada. Diferencia: S/ ${cerrada.diferencia.toFixed(2)} (${cerrada.estado})`);
        this.refrescarTodo();
      },
      error: (err) => {
        this.procesandoAccion.set(false);
        this.notify.showError('Error al cerrar liquidación', mensajeError(err, err?.message || 'No se pudo cerrar la liquidación.'));
      }
    });
  }

  // --- Devoluciones en Ventanilla ---
  entregarDevolucion(id: number): void {
    if (this.procesandoAccion()) return;
    this.procesandoAccion.set(true);
    this.feedbackService.marcarDevuelto(id).subscribe({
      next: () => this.procesandoAccion.set(false),
      error: err => {
        this.procesandoAccion.set(false);
        this.notify.showError('No se pudo registrar la entrega', mensajeError(err, 'Intenta de nuevo.'));
      }
    });
  }

  // --- Incidente Operativo (Cajero) ---
  readonly mostrarModalIncidente = signal<boolean>(false);
  incidenteFormCajero: IncidenteForm = {
    titulo: '',
    modulo: 'COCINA_HORNO',
    severidad: 'MEDIA',
    causaRaiz: '',
    solucionAplicada: ''
  };

  confirmarIncidenteCajero(): void {
    if (!this.incidenteFormCajero.titulo.trim() || !this.incidenteFormCajero.causaRaiz.trim()) {
      this.notify.showWarning('Por favor ingresa título y causa raíz');
      return;
    }
    this.securityAuditService.registrarIncidente({
      titulo: this.incidenteFormCajero.titulo,
      modulo: this.incidenteFormCajero.modulo,
      severidad: this.incidenteFormCajero.severidad,
      causaRaiz: this.incidenteFormCajero.causaRaiz,
      solucionAplicada: this.incidenteFormCajero.solucionAplicada || 'Reportado por cajero',
      reportadoPor: this.auth.currentUser()?.nombre || 'Cajero de Turno'
    }).subscribe({
      next: () => {
        this.mostrarModalIncidente.set(false);
        this.incidenteFormCajero = { titulo: '', modulo: 'COCINA_HORNO', severidad: 'MEDIA', causaRaiz: '', solucionAplicada: '' };
      },
      error: () => this.notify.showError('No se pudo registrar el incidente')
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
