import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { tap, catchError, of } from 'rxjs';
import { OrdersService } from '../../../../core/services/orders.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AjustesWhatsapp, WhatsappNotificationsService } from '../../../../core/services/whatsapp-notifications.service';
import { PaymentService, PagoOrdenAdmin } from '../../../../core/services/payment.service';
import { Order } from '../../../../core/models/order.model';
import { EstadoNotificacion } from '../../../../core/models/notification-log.model';
import { AdminShellStore } from '../../state/admin-shell.store';
import { AjustesWhatsappForm, FiltroNotificaciones } from '../../models/admin-forms';
import { WhatsappSessionPanelComponent } from '../../components/notificaciones/whatsapp-session-panel.component';
import { WhatsappProofsPanelComponent } from '../../components/notificaciones/whatsapp-proofs-panel.component';
import { WhatsappSettingsPanelComponent } from '../../components/notificaciones/whatsapp-settings-panel.component';
import { NotificationHistoryComponent } from '../../components/notificaciones/notification-history.component';
import { WhatsappProofModalComponent } from '../../components/notificaciones/whatsapp-proof-modal.component';

/** Contenedor (smart) de la pestaña NOTIFICACIONES & WHATSAPP: sesión, comprobantes, ajustes e historial. */
@Component({
  selector: 'app-admin-notificaciones-page',
  standalone: true,
  imports: [
    CommonModule,
    WhatsappSessionPanelComponent,
    WhatsappProofsPanelComponent,
    WhatsappSettingsPanelComponent,
    NotificationHistoryComponent,
    WhatsappProofModalComponent
  ],
  host: { class: 'contents' },
  template: `
    <main class="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

      <app-whatsapp-session-panel
        [status]="whatsappService.status()"
        [ajustes]="whatsappService.ajustes()"
        [totales]="whatsappService.totales()"
        [qr]="whatsappService.qr()"
        [qrError]="whatsappService.qrError()"
        [diagnostico]="whatsappService.diagnostico()"
        [isLoading]="whatsappService.isLoading()"
        [reiniciandoWhatsapp]="reiniciandoWhatsapp()"
        (refreshRequested)="cargarNotificaciones()"
        (restartRequested)="reiniciarSesionWhatsapp()"
      />

      <app-whatsapp-proofs-panel
        [comprobantesWhatsappPendientes]="store.comprobantesWhatsappPendientes()"
        [capturasPendientesIds]="capturasPendientesIds()"
        (refreshRequested)="refrescarComprobantesWhatsapp()"
        (verifyRequested)="abrirVerificacionWhatsapp($event)"
      />

      <app-whatsapp-settings-panel
        [ajustes]="whatsappService.ajustes()"
        [gobernador]="whatsappService.gobernador()"
        [ajustesCargando]="whatsappService.ajustesCargando()"
        [guardandoAjustes]="whatsappService.guardandoAjustes()"
        [ajustesError]="whatsappService.ajustesError()"
        (refreshRequested)="whatsappService.cargarAjustes()"
        (saveRequested)="guardarAjustesWhatsapp($event)"
        (toggle24hRequested)="alternarOperativoTodoElDia()"
      />

      <app-notification-history
        [historial]="whatsappService.historial()"
        [error]="whatsappService.error()"
        [isLoading]="whatsappService.isLoading()"
        (searchRequested)="aplicarFiltros($event)"
      />

    </main>

    <!-- Modal: validación de comprobante Yape recibido por WhatsApp -->
    @if (ordenParaVerificarWhatsapp(); as ordenVerificar) {
      <app-whatsapp-proof-modal
        [orden]="ordenVerificar"
        [comprobanteWhatsappData]="comprobanteWhatsappData()"
        [cargandoComprobanteWhatsapp]="cargandoComprobanteWhatsapp()"
        [verificandoWhatsapp]="verificandoWhatsapp()"
        [motivoRechazoWhatsapp]="motivoRechazoWhatsapp()"
        [errorVerifWhatsapp]="errorVerifWhatsapp()"
        [feedbackVerifWhatsapp]="feedbackVerifWhatsapp()"
        (closed)="cerrarVerificacionWhatsapp()"
        (motivoChange)="motivoRechazoWhatsapp.set($event)"
        (approved)="aprobarComprobanteWhatsapp()"
        (rejected)="rechazarComprobanteWhatsapp()"
      />
    }
  `
})
export class AdminNotificacionesPage implements OnInit, OnDestroy {
  readonly ordersService = inject(OrdersService);
  readonly whatsappService = inject(WhatsappNotificationsService);
  readonly paymentService = inject(PaymentService);
  readonly notify = inject(NotificationService);
  readonly store = inject(AdminShellStore);
  private platformId = inject(PLATFORM_ID);

  /** Ids de las órdenes con una captura de comprobante por validar. */
  readonly capturasPendientesIds = computed(() =>
    new Set(this.store.comprobantesWhatsappPendientes().filter(o => this.tieneCapturaPendiente(o)).map(o => String(o.id)))
  );

  ngOnInit(): void {
    this.cargarNotificaciones();
    // Los ajustes se piden al abrir la pestaña, no en cada filtro (no pisa el borrador sin querer).
    // El QR solo se consulta mientras la pestaña de WhatsApp está abierta.
    if (isPlatformBrowser(this.platformId)) {
      this.whatsappService.cargarAjustes();
      this.whatsappService.iniciarSondeoQr();
    }
  }

  ngOnDestroy(): void {
    this.whatsappService.detenerSondeoQr();
  }

  // ── Validación de comprobantes Yape dentro del módulo WhatsApp ───────────
  readonly ordenParaVerificarWhatsapp = signal<Order | null>(null);
  readonly comprobanteWhatsappData = signal<PagoOrdenAdmin | null>(null);
  readonly cargandoComprobanteWhatsapp = signal<boolean>(false);
  readonly verificandoWhatsapp = signal<boolean>(false);
  readonly motivoRechazoWhatsapp = signal<string>('');
  readonly errorVerifWhatsapp = signal<string | null>(null);
  readonly feedbackVerifWhatsapp = signal<{ aprobado: boolean; ordenId: string } | null>(null);

  tieneCapturaPendiente(orden: Order): boolean {
    const pago = this.paymentService.pagosPorOrdenMap().get(String(orden.id));
    return pago?.estado === 'PENDIENTE_VERIFICACION' || !!pago?.comprobanteUrl;
  }

  refrescarComprobantesWhatsapp(): void {
    this.ordersService.loadActiveOrders();
    this.paymentService.cargarPagos().subscribe();
    this.notify.showInfo('Actualizando comprobantes y pedidos...');
  }

  abrirVerificacionWhatsapp(orden: Order): void {
    this.ordenParaVerificarWhatsapp.set(orden);
    this.comprobanteWhatsappData.set(null);
    this.cargandoComprobanteWhatsapp.set(true);
    this.motivoRechazoWhatsapp.set('');
    this.errorVerifWhatsapp.set(null);
    this.feedbackVerifWhatsapp.set(null);

    this.paymentService.obtenerPagoParaVerificacion(orden.id).pipe(
      tap(pago => {
        this.comprobanteWhatsappData.set(pago);
        this.cargandoComprobanteWhatsapp.set(false);
      }),
      catchError(err => {
        this.cargandoComprobanteWhatsapp.set(false);
        this.errorVerifWhatsapp.set(
          err?.message || 'No se encontró un registro de pago activo para esta orden.'
        );
        return of(null);
      })
    ).subscribe();
  }

  cerrarVerificacionWhatsapp(): void {
    this.ordenParaVerificarWhatsapp.set(null);
    this.comprobanteWhatsappData.set(null);
    this.motivoRechazoWhatsapp.set('');
    this.errorVerifWhatsapp.set(null);
    this.feedbackVerifWhatsapp.set(null);
  }

  aprobarComprobanteWhatsapp(): void {
    const orden = this.ordenParaVerificarWhatsapp();
    const pago = this.comprobanteWhatsappData();
    if (!orden || this.verificandoWhatsapp()) return;

    const pagoFromMap = this.paymentService.pagosPorOrdenMap().get(String(orden.id));
    const pagoId = pago?.id || (pagoFromMap ? Number(pagoFromMap.id) : null);

    if (!pagoId) {
      this.errorVerifWhatsapp.set('No se encontró el pago registrado para esta orden.');
      return;
    }

    this.verificandoWhatsapp.set(true);
    this.errorVerifWhatsapp.set(null);

    this.paymentService.verificarComprobante(pagoId, true).pipe(
      tap(actualizado => {
        this.verificandoWhatsapp.set(false);
        this.comprobanteWhatsappData.set(actualizado);
        this.feedbackVerifWhatsapp.set({ aprobado: true, ordenId: String(orden.id) });
        this.notify.showSuccess(`Comprobante de orden #${orden.id} aprobado. Pedido enviado a cocina.`);
        this.ordersService.loadActiveOrders();
        this.paymentService.cargarPagos().subscribe();
        setTimeout(() => this.cerrarVerificacionWhatsapp(), 1800);
      }),
      catchError(err => {
        this.verificandoWhatsapp.set(false);
        this.errorVerifWhatsapp.set(
          err?.message || 'Error al aprobar el comprobante en el microservicio de pagos.'
        );
        return of(null);
      })
    ).subscribe();
  }

  rechazarComprobanteWhatsapp(): void {
    const orden = this.ordenParaVerificarWhatsapp();
    const pago = this.comprobanteWhatsappData();
    const motivo = this.motivoRechazoWhatsapp().trim();

    if (!orden || this.verificandoWhatsapp()) return;
    if (!motivo) {
      this.errorVerifWhatsapp.set('Debes ingresar un motivo de rechazo para el cliente.');
      return;
    }

    const pagoFromMap = this.paymentService.pagosPorOrdenMap().get(String(orden.id));
    const pagoId = pago?.id || (pagoFromMap ? Number(pagoFromMap.id) : null);

    if (!pagoId) {
      this.errorVerifWhatsapp.set('No se encontró el pago registrado para esta orden.');
      return;
    }

    this.verificandoWhatsapp.set(true);
    this.errorVerifWhatsapp.set(null);

    this.paymentService.verificarComprobante(pagoId, false, motivo).pipe(
      tap(actualizado => {
        this.verificandoWhatsapp.set(false);
        this.comprobanteWhatsappData.set(actualizado);
        this.feedbackVerifWhatsapp.set({ aprobado: false, ordenId: String(orden.id) });
        this.notify.showSuccess(`Comprobante rechazado. Se notificó al cliente por WhatsApp.`);
        this.ordersService.loadActiveOrders();
        this.paymentService.cargarPagos().subscribe();
        setTimeout(() => this.cerrarVerificacionWhatsapp(), 1800);
      }),
      catchError(err => {
        this.verificandoWhatsapp.set(false);
        this.errorVerifWhatsapp.set(
          err?.message || 'Error al rechazar el comprobante en el microservicio de pagos.'
        );
        return of(null);
      })
    ).subscribe();
  }

  // Notificaciones WhatsApp (RF30, RF31, RF32 - Fase 3)
  filtroNotifOrdenId: number | null = null;
  filtroNotifEstado: EstadoNotificacion | '' = '';
  filtroNotifDesde = '';
  readonly reiniciandoWhatsapp = signal<boolean>(false);

  cargarNotificaciones(): void {
    this.whatsappService.cargar({
      ordenId: this.filtroNotifOrdenId,
      estado: this.filtroNotifEstado,
      desde: this.filtroNotifDesde
    });
  }

  aplicarFiltros(filtros: FiltroNotificaciones): void {
    this.filtroNotifOrdenId = filtros.ordenId;
    this.filtroNotifEstado = filtros.estado;
    this.filtroNotifDesde = filtros.desde;
    this.cargarNotificaciones();
  }

  reiniciarSesionWhatsapp(): void {
    if (this.reiniciandoWhatsapp()) return;
    this.reiniciandoWhatsapp.set(true);
    this.whatsappService.reiniciarSesion().subscribe({
      next: (res) => {
        this.reiniciandoWhatsapp.set(false);
        this.notify.showSuccess('WhatsApp reiniciado', res?.mensaje || 'Se ha solicitado un nuevo código QR.');
      },
      error: (err) => {
        this.reiniciandoWhatsapp.set(false);
        this.notify.showError('Error al reiniciar WhatsApp', err?.error?.error || err?.message || 'No se pudo reiniciar la sesión.');
      }
    });
  }

  /**
   * T5b — arma el PATCH con SOLO los campos que cambiaron respecto de los ajustes vigentes.
   * Así el panel nunca reescribe valores que el admin no tocó.
   */
  alternarOperativoTodoElDia(): void {
    const actual = this.whatsappService.ajustes()?.operativoTodoElDia ?? false;
    this.whatsappService.guardarAjustes({ operativoTodoElDia: !actual });
  }

  guardarAjustesWhatsapp(form: AjustesWhatsappForm): void {
    const actuales = this.whatsappService.ajustes();
    
    const cambios: Partial<AjustesWhatsapp> = {};

    const camposNumericos = [
      'intervaloMs', 'jitterPct', 'typingMinMs', 'typingMaxMs', 'typingMsPorCaracter',
      'presupuestoHora', 'presupuestoDia', 'horaDesde', 'horaHasta', 'breakerBaseMs', 'breakerMaxMs'
    ] as const satisfies readonly (keyof AjustesWhatsapp)[];

    for (const campo of camposNumericos) {
      if (form[campo] !== actuales?.[campo]) cambios[campo] = form[campo];
    }
    if (form.numeroAsesor !== (actuales?.numeroAsesor ?? '')) cambios.numeroAsesor = form.numeroAsesor;
    if (form.numeroRespaldo !== (actuales?.numeroRespaldo ?? '')) cambios.numeroRespaldo = form.numeroRespaldo;
    if (form.numeroYape !== (actuales?.numeroYape ?? '')) cambios.numeroYape = form.numeroYape;

    // Sin cambios no se dispara un PATCH vacío.
    this.whatsappService.guardarAjustes(cambios);
  }
}
