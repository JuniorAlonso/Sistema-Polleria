import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CajeroDashboardComponent } from './cajero-dashboard.component';
import { OrdersService } from '../../core/services/orders.service';
import { FinanceService } from '../../core/services/finance.service';
import { Order } from '../../core/models/order.model';
import { PaymentTransaction } from '../../core/models/payment.model';
import { PaymentService } from '../../core/services/payment.service';
import { NotificationService } from '../../core/services/notification.service';
import { of, throwError } from 'rxjs';
import { CobroSalonFacade } from './services/cobro-salon.facade';
import { consumidorFinal } from './models/datos-fiscales';
import { ArqueoCaja } from '../../core/models/finance.model';
import { BackendComprobanteResponse } from '../../core/models/api-contracts.model';

describe('CajeroDashboardComponent', () => {
  let component: CajeroDashboardComponent;
  let fixture: ComponentFixture<CajeroDashboardComponent>;
  let ordersService: OrdersService;
  let financeService: FinanceService;

  const mockOrder: Order = {
    id: '101',
    codigoSeguimiento: 'POL-101',
    cliente: {
      nombre: 'Juan Perez',
      celular: '987654321',
      mesaNumero: 4
    },
    items: [
      {
        product: {
          id: 'prod-1',
          nombre: '1/2 Pollo a la Brasa',
          descripcion: 'Con papas y ensalada',
          precio: 45.0,
          categoria: 'POLLOS_A_LA_BRASA',
          imagenUrl: '',
          agotado: false
        },
        cantidad: 1,
        subtotal: 45.0
      }
    ],
    tipo: 'SALON',
    estado: 'LISTO',
    subtotal: 45.0,
    costoEnvio: 0,
    descuento: 0,
    total: 45.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroDashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroDashboardComponent);
    component = fixture.componentInstance;
    ordersService = TestBed.inject(OrdersService);
    financeService = TestBed.inject(FinanceService);
    fixture.detectChanges();
  });

  it('debe crearse correctamente el componente de cajero', () => {
    expect(component).toBeTruthy();
  });

  it('debe iniciar en la pestaña POS por defecto', () => {
    expect(component.activeTab()).toBe('POS');
  });

  const abrirCaja = () => financeService.cajaActual.set({ estado: 'ABIERTA' } as never);

  it('debe seleccionar una comanda para cobro y calcular vuelto exacto inicial', () => {
    abrirCaja();
    component.seleccionarOrdenParaCobro(mockOrder);

    expect(component.ordenSeleccionada()).toEqual(mockOrder);
    expect(component.metodoCobroSeleccionado()).toBe('EFECTIVO');
    expect(component.efectivoRecibidoInput).toBe(45.0);
    expect(component.vueltoCalculado()).toBe(0);
    expect(component.esCobroValido()).toBeTrue();
  });

  it('debe calcular vuelto positivo cuando el efectivo recibido es mayor', () => {
    abrirCaja();
    component.seleccionarOrdenParaCobro(mockOrder);
    component.efectivoRecibidoInput = 50.0;

    expect(component.vueltoCalculado()).toBe(5.0);
    expect(component.esCobroValido()).toBeTrue();
  });

  it('debe invalidar cobro en efectivo si el monto recibido es menor', () => {
    abrirCaja();
    component.seleccionarOrdenParaCobro(mockOrder);
    component.efectivoRecibidoInput = 30.0;

    expect(component.vueltoCalculado()).withContext('change is never negative').toBe(0);
    expect(component.esCobroValido()).toBeFalse();
  });

  it('Mercado Pago es válido sin referencia manual (redirige a Checkout Pro)', () => {
    component.seleccionarOrdenParaCobro(mockOrder);
    component.metodoCobroSeleccionado.set('MERCADO_PAGO');
    component.referenciaPagoInput = '';

    expect(component.esCobroValido()).toBeTrue();
  });

  it('R3.7: sin caja abierta el efectivo queda bloqueado y el cobro arranca en Mercado Pago', () => {
    financeService.cajaActual.set(null);
    component.seleccionarOrdenParaCobro(mockOrder);

    expect(component.metodoCobroSeleccionado()).toBe('MERCADO_PAGO');
    component.metodoCobroSeleccionado.set('EFECTIVO');
    component.efectivoRecibidoInput = 50;
    expect(component.esCobroValido()).toBeFalse();
  });

  it('D3.8: datos fiscales inválidos impiden cobrar', () => {
    abrirCaja();
    component.seleccionarOrdenParaCobro(mockOrder);
    component.datosFiscalesCobro.set({ tipo: 'FACTURA', tipoDoc: 'RUC', numDoc: '123', nombre: 'ACME' });

    expect(component.esCobroValido()).toBeFalse();
  });

  it('debe cambiar de pestañas entre POS, ARQUEO e HISTORIAL', () => {
    component.activeTab.set('ARQUEO');
    expect(component.activeTab()).toBe('ARQUEO');

    component.activeTab.set('HISTORIAL');
    expect(component.activeTab()).toBe('HISTORIAL');
  });

  describe('S1: bandeja de capturas', () => {
    const porPagar = (id: string, canalOrigen?: Order['canalOrigen']): Order =>
      ({ ...mockOrder, id, codigoSeguimiento: `POL-${id}`, tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', canalOrigen });

    it('lista solo pedidos de WhatsApp o con captura; un pago web en pasarela no aparece', () => {
      ordersService.orders.set([porPagar('1', 'WEB'), porPagar('2', 'WHATSAPP'), porPagar('3', 'WEB'), porPagar('4')]);
      component.pagosPorVerificar.set([
        { id: 9, ordenId: 3, monto: 45, estado: 'PENDIENTE', comprobanteUrl: 'https://img/3.jpg' }
      ]);

      expect(component.capturasPendientes().map(c => c.orden.id)).toEqual(['2', '3']);
    });
  });

  describe('S7/S13: entrega de recojo', () => {
    let notify: jasmine.SpyObj<NotificationService>;
    let paymentService: PaymentService;

    const recojo = (extra: Partial<Order> = {}): Order => ({
      ...mockOrder,
      id: '12',
      codigoSeguimiento: 'POL-12',
      numeroCliente: 7,
      tipo: 'RECOJO_EN_TIENDA',
      estado: 'LISTO_COCINA',
      total: 30,
      ...extra
    });

    beforeEach(() => {
      notify = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
      spyOn(notify, 'showError');
      spyOn(notify, 'showSuccess');
      paymentService = TestBed.inject(PaymentService);
    });

    it('rechaza el número de cliente como ticket: solo vale el código POL-<id>', () => {
      const update = spyOn(ordersService, 'updateOrderStatus');

      component.entregarRecojo({ orden: recojo(), codigoTicket: '7', efectivoRecibido: 0 });

      expect(update).not.toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith('Ticket no coincide', jasmine.any(String));
    });

    it('envía el ticket al backend al entregar un recojo ya pagado', () => {
      const update = spyOn(ordersService, 'updateOrderStatus').and.returnValue(of(recojo({ estado: 'COMPLETADO' })));

      component.entregarRecojo({ orden: recojo(), codigoTicket: ' pol-12 ', efectivoRecibido: 0 });

      expect(update).toHaveBeenCalledWith('12', 'COMPLETADO', undefined, 'POL-12');
    });

    it('envía el ticket al backend al cobrar un recojo ContraPago y registra la venta en caja (DIN-10)', () => {
      const cobro = spyOn(paymentService, 'registrarCobroEfectivo').and.returnValue(of({} as PaymentTransaction));
      const ventaCaja = spyOn(financeService, 'registrarVentaEnCaja').and.returnValue(of({} as BackendComprobanteResponse));

      component.entregarRecojo({ orden: recojo({ requiereCobroEfectivo: true }), codigoTicket: '12', efectivoRecibido: 50 });

      expect(cobro).toHaveBeenCalledWith('12', 30, 50, 20, 'POL-12');
      expect(ventaCaja).toHaveBeenCalledWith(
        '12',
        jasmine.objectContaining({ tipo: 'BOLETA', nombre: 'Juan Perez' }),
        true
      );
    });

    it('S13: avisa al cajero si el ingreso en caja falla después de cobrar', () => {
      spyOn(paymentService, 'registrarCobroEfectivo').and.returnValue(of({} as PaymentTransaction));
      financeService.cajaActual.set({ estado: 'ABIERTA' } as never);
      spyOn(financeService, 'registrarVentaEnCaja').and.returnValue(throwError(() => new Error('caja caída')));

      component.entregarRecojo({ orden: recojo({ requiereCobroEfectivo: true }), codigoTicket: 'POL-12', efectivoRecibido: 30 });

      expect(financeService.registrarVentaEnCaja).toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith(
        'No se registró el ingreso en caja',
        jasmine.stringMatching(/manualmente/));
    });

    it('el botón de entregar dice por qué está bloqueado en vez de no hacer nada', () => {
      ordersService.orders.set([recojo({ requiereCobroEfectivo: true })]);
      component.activeTab.set('RECOJO_TIENDA');
      fixture.detectChanges();

      const motivo = () => (fixture.nativeElement.querySelector('[data-testid="recojo-bloqueo"]') as HTMLElement | null);
      expect(motivo()?.textContent).toContain('Escribe el código del ticket');

      const ticket = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
      ticket.value = 'POL-12';
      ticket.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(motivo()?.textContent).toContain('no cubre el total');

      const efectivo = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
      efectivo.value = '30';
      efectivo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(motivo()).withContext('todo listo: no queda motivo de bloqueo').toBeNull();
    });
  });

  describe('retroalimentación y alineación del cajero', () => {
    let notify: NotificationService;
    let paymentService: PaymentService;
    const hace = (min: number) => new Date(Date.now() - min * 60000).toISOString();
    const orden = (extra: Partial<Order>): Order => ({ ...mockOrder, ...extra });

    beforeEach(() => {
      notify = TestBed.inject(NotificationService);
      spyOn(notify, 'showError');
      spyOn(notify, 'showSuccess');
      spyOn(notify, 'showInfo');
      paymentService = TestBed.inject(PaymentService);
    });

    it('capturas: una captura ya subida no vence y se puede confirmar aunque pasaron 15 minutos', () => {
      ordersService.orders.set([orden({ id: '31', codigoSeguimiento: 'POL-31', tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', canalOrigen: 'WHATSAPP', createdAt: hace(30) })]);
      component.pagosPorVerificar.set([{ id: 5, ordenId: 31, monto: 45, estado: 'PENDIENTE_VERIFICACION', comprobanteUrl: 'https://img/31.jpg' }]);
      component.activeTab.set('CAPTURAS_PAGO');
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).not.toContain('Plazo vencido');
      expect(texto).toContain('no vence');
      const confirmar = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
        .find(b => (b.textContent || '').includes('Confirmar Pago'))!;
      expect(confirmar.disabled).toBeFalse();
    });

    it('capturas: sin captura el plazo de 15 minutos sigue corriendo', () => {
      ordersService.orders.set([orden({ id: '32', codigoSeguimiento: 'POL-32', tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', canalOrigen: 'WHATSAPP', createdAt: hace(30) })]);
      component.activeTab.set('CAPTURAS_PAGO');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Plazo vencido');
    });

    it('confirmar pago avisa que el pedido pasa a la cola de cocina', () => {
      spyOn(paymentService, 'verificarComprobante').and.returnValue(of({ id: 5, ordenId: 31, monto: 45, estado: 'APROBADO' }));

      component.aprobarCaptura({ id: 5, ordenId: 31, monto: 45, estado: 'PENDIENTE_VERIFICACION' });

      expect(notify.showSuccess).toHaveBeenCalledWith(jasmine.any(String), jasmine.stringMatching(/cola de cocina/));
    });

    it('llamadas: un rechazo del backend muestra SU motivo y libera los botones', () => {
      const pendiente = orden({ id: '41', codigoSeguimiento: 'POL-41', tipo: 'DELIVERY', estado: 'PENDIENTE_CONFIRMACION' });
      spyOn(ordersService, 'confirmarLlamada').and.callFake(() => {
        expect(component.procesandoAccion()).withContext('bloqueado mientras responde').toBeTrue();
        return throwError(() => ({ status: 409, error: { error: 'El plazo de 15 minutos para confirmar la llamada venció' }, message: 'Http failure response' }));
      });

      component.confirmarLlamadaPedido(pendiente);

      expect(notify.showError).toHaveBeenCalledWith('No se pudo confirmar la llamada', 'El plazo de 15 minutos para confirmar la llamada venció');
      expect(component.procesandoAccion()).toBeFalse();
    });

    it('llamadas: si la boleta no se emite, el cajero se entera', () => {
      const pendiente = orden({ id: '42', codigoSeguimiento: 'POL-42', tipo: 'DELIVERY', estado: 'PENDIENTE_CONFIRMACION' });
      spyOn(ordersService, 'confirmarLlamada').and.returnValue(of({ ...pendiente, estado: 'PAGADO' }));
      spyOn(financeService, 'emitirComprobante').and.returnValue(throwError(() => ({ status: 503, error: { error: 'finance caído' } })));

      component.confirmarLlamadaPedido(pendiente);

      expect(notify.showSuccess).toHaveBeenCalled();
      expect(notify.showError).toHaveBeenCalledWith('No se emitió la boleta', jasmine.stringMatching(/finance caído/));
    });

    it('llamadas: registrar "no contesta" y cancelar muestran el motivo del backend', () => {
      const pendiente = orden({ id: '43', codigoSeguimiento: 'POL-43', tipo: 'DELIVERY', estado: 'PENDIENTE_CONFIRMACION' });
      spyOn(ordersService, 'registrarIntentoLlamada').and.returnValue(throwError(() => ({ status: 409, error: { error: 'motivo intento' } })));
      spyOn(ordersService, 'updateOrderStatus').and.returnValue(throwError(() => ({ status: 409, error: { error: 'motivo cancelar' } })));
      spyOn(window, 'confirm').and.returnValue(true);

      component.intentoLlamadaPedido(pendiente);
      component.cancelarPedidoContraPago(pendiente);

      expect(notify.showError).toHaveBeenCalledWith('No se pudo registrar el intento', 'motivo intento');
      expect(notify.showError).toHaveBeenCalledWith('No se pudo cancelar el pedido', 'motivo cancelar');
      expect(component.procesandoAccion()).toBeFalse();
    });

    it('POS: solo lista lo que se cobra en caja (salón); delivery, recojo y pedidos sin pagar o sin confirmar van por su propio flujo', () => {
      ordersService.orders.set([
        orden({ id: '51', tipo: 'SALON', estado: 'LISTO' as never }),
        orden({ id: '52', tipo: 'DELIVERY', estado: 'EN_REPARTO' }),
        orden({ id: '53', tipo: 'RECOJO_EN_TIENDA', estado: 'LISTO_COCINA' }),
        orden({ id: '54', tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO' }),
        orden({ id: '55', tipo: 'RECOJO_EN_TIENDA', estado: 'PENDIENTE_CONFIRMACION' }),
        orden({ id: '56', tipo: 'DELIVERY', estado: 'PEDIDO_FANTASMA' })
      ]);

      expect(component.comandasPorCobrar().map(o => o.id)).toEqual(['51']);
    });

    it('POS: con el estado de la mesa publicado, solo lista las mesas que pidieron la cuenta (D3.14)', () => {
      ordersService.orders.set([
        orden({ id: '61', tipo: 'SALON', estado: 'LISTO' as never, mesaEstado: 'POR_COBRAR' }),
        orden({ id: '62', tipo: 'SALON', estado: 'LISTO' as never, mesaEstado: 'OCUPADA' }),
        orden({ id: '63', tipo: 'SALON', estado: 'LISTO' as never })
      ]);

      expect(component.comandasPorCobrar().map(o => o.id))
        .withContext('sin mesaEstado (backend anterior) se conserva el comportamiento actual')
        .toEqual(['61', '63']);
    });

    it('POS: delega el cobro en la fachada con los datos fiscales y arma el ticket con el comprobante real', () => {
      abrirCaja();
      const comprobante = { serieCorrelativo: 'B001-000007', total: 45 } as never;
      const cobrar = spyOn(TestBed.inject(CobroSalonFacade), 'cobrar').and.returnValue(of({ comprobante }));
      component.seleccionarOrdenParaCobro(mockOrder);
      component.efectivoRecibidoInput = 50;

      component.confirmarCobroComanda();

      expect(cobrar).toHaveBeenCalledWith(mockOrder, 'EFECTIVO', jasmine.stringMatching(/Recibido S\/ 50.00/), consumidorFinal());
      expect(component.ticketEmitido().comprobante).toBe(comprobante);
      expect(component.ticketEmitido().clienteNombre).toBe('Juan Perez');
      expect(component.ticketEmitido().total).toBe(45);
      expect(component.ordenSeleccionada()).toBeNull();
    });

    it('POS: si el pago pasó pero el comprobante falla, avisa "Pago OK, comprobante pendiente" sin ticket', () => {
      abrirCaja();
      spyOn(TestBed.inject(CobroSalonFacade), 'cobrar').and.returnValue(throwError(() => ({
        paso: 'COMPROBANTE', mensaje: 'No hay una caja abierta', pagoAprobado: true
      })));
      component.seleccionarOrdenParaCobro(mockOrder);

      component.confirmarCobroComanda();

      expect(notify.showError).toHaveBeenCalledWith('Pago OK, comprobante pendiente', jasmine.stringMatching(/sin cobrar de nuevo/));
      expect(component.ticketEmitido()).toBeNull();
      expect(component.procesandoAccion()).toBeFalse();
    });

    it('POS: si el cobro no llegó a aprobarse, muestra el motivo del backend', () => {
      abrirCaja();
      spyOn(TestBed.inject(CobroSalonFacade), 'cobrar').and.returnValue(throwError(() => ({
        paso: 'PAGO', mensaje: 'El monto S/ 45 no coincide', pagoAprobado: false
      })));
      component.seleccionarOrdenParaCobro(mockOrder);

      component.confirmarCobroComanda();

      expect(notify.showError).toHaveBeenCalledWith('El monto S/ 45 no coincide');
    });

    it('capturas: muestra motivo de bloqueo si falta la captura de pago', () => {
      ordersService.orders.set([orden({ id: '35', codigoSeguimiento: 'POL-35', tipo: 'DELIVERY', estado: 'PENDIENTE_PAGO', canalOrigen: 'WHATSAPP' })]);
      component.pagosPorVerificar.set([]);
      component.activeTab.set('CAPTURAS_PAGO');
      fixture.detectChanges();

      const bloqueo = fixture.nativeElement.querySelector('[data-testid="captura-bloqueo"]') as HTMLElement;
      expect(bloqueo?.textContent).toContain('Esperando que el cliente suba la captura');
      const botonAprobar = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
        .find(b => (b.textContent || '').includes('Confirmar Pago'))!;
      expect(botonAprobar.disabled).toBeTrue();
    });
  });
  describe('S6/S7: cierre de caja ciego y rendición de repartidor', () => {
    let notify: NotificationService;
    const MENSAJE_400 =
      'El efectivo contado no coincide con el esperado. Vuelve a contar o indica el motivo en las observaciones.';

    beforeEach(() => {
      notify = TestBed.inject(NotificationService);
      spyOn(notify, 'showError');
      spyOn(notify, 'showSuccess');
      financeService.cajaActual.set({ estado: 'ABIERTA', montoApertura: 100 } as never);
    });

    it('S6: opening the close modal does not pre-fill the counted cash nor the observations', () => {
      component.abrirModalCierre();
      fixture.detectChanges();

      expect(component.efectivoCierreInput).toBeNull();
      expect(component.observacionesCierreInput).toBe('');
      expect(component.errorCierre()).toBeNull();
      expect(component.motivoCierreObligatorio()).toBeFalse();
    });

    it('S6: a 400 keeps the modal open, shows the backend message and requires a reason before retrying', () => {
      const cerrar = spyOn(financeService, 'cerrarCaja').and.returnValues(
        throwError(() => ({ status: 400, error: { error: MENSAJE_400 } })),
        of({ id: 1, estado: 'CERRADA', totalEsperado: 120, diferencia: -20 } as unknown as ArqueoCaja)
      );
      component.abrirModalCierre();
      component.efectivoCierreInput = 100;

      component.ejecutarCierreCaja();
      fixture.detectChanges();

      expect(component.mostrarModalCierre()).toBeTrue();
      expect(component.procesandoAccion()).toBeFalse();
      expect(component.errorCierre()).toBe(MENSAJE_400);
      expect(component.motivoCierreObligatorio()).toBeTrue();
      expect(fixture.nativeElement.textContent).toContain(MENSAJE_400);

      component.ejecutarCierreCaja();
      expect(cerrar).withContext('blocked without a reason').toHaveBeenCalledTimes(1);

      component.observacionesCierreInput = 'Faltan S/ 20 por vuelto mal dado';
      component.ejecutarCierreCaja();

      expect(cerrar).toHaveBeenCalledTimes(2);
      expect(cerrar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
        montoCierreEfectivo: 100,
        observaciones: 'Faltan S/ 20 por vuelto mal dado'
      }));
      expect(component.mostrarModalCierre()).toBeFalse();
      expect(notify.showSuccess).toHaveBeenCalledWith(jasmine.stringMatching(/120\.00.*-20\.00/));
    });

    it('S6: cannot close without entering the counted cash', () => {
      const cerrar = spyOn(financeService, 'cerrarCaja');
      component.abrirModalCierre();

      component.ejecutarCierreCaja();

      expect(cerrar).not.toHaveBeenCalled();
      expect(component.mostrarModalCierre()).toBeTrue();
    });

    const liq = {
      id: 12, repartidorId: 5, repartidorNombre: 'Carlos', fondoInicial: 50, totalCobradoEfectivo: 0,
      totalRendido: 0, diferencia: 0, estado: 'ABIERTA', creadoEn: '2026-11-09T10:00:00'
    } as const;

    it('S7: settlement close pre-loads fondo + cash pending from /pendiente', () => {
      const pendiente = spyOn(financeService, 'obtenerEfectivoPendienteLiquidacion').and.returnValue(
        of({ repartidorId: 5, liquidacionId: 12, desde: '', total: 35.5, cantidad: 2, pagos: [] }));

      component.abrirModalCierreLiquidacion({ ...liq });
      fixture.detectChanges();

      expect(pendiente).toHaveBeenCalledWith(5);
      expect(component.totalRendidoLiqInput).toBe(85.5);
      expect(component.pendienteLiq()?.total).toBe(35.5);
      expect(component.cargandoPendienteLiq()).toBeFalse();
      expect(fixture.nativeElement.textContent).toContain('85.50');
    });

    it('S7: if /pendiente fails the amount is not pre-filled and the error is shown', () => {
      spyOn(financeService, 'obtenerEfectivoPendienteLiquidacion').and.returnValue(
        throwError(() => ({ status: 503, error: { error: 'finance caído' } })));

      component.abrirModalCierreLiquidacion({ ...liq });
      fixture.detectChanges();

      expect(component.totalRendidoLiqInput).toBeNull();
      expect(component.errorPendienteLiq()).toBe('finance caído');
      expect(fixture.nativeElement.textContent).toContain('finance caído');
    });

    it('FE-01/CON-12/FE-03: bloquea doble envío, filtra cobrosDelDia en hora de Lima sin inventar campos y consulta comprobante real al reimprimir', () => {
      component.procesandoAccion.set(true);
      const devSpy = spyOn(component['feedbackService'], 'marcarDevuelto');
      component.entregarDevolucion(9);
      expect(devSpy).not.toHaveBeenCalled();
      component.procesandoAccion.set(false);

      const hoyLima = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const paymentService = TestBed.inject(PaymentService);
      paymentService.pagos.set([
        { id: '1', orderId: '888', metodo: 'YAPE', monto: 42, estado: 'APROBADO', fechaTransaccion: `${hoyLima}T15:00:00-05:00` },
        { id: '2', orderId: '889', metodo: 'TARJETA', monto: 19, estado: 'APROBADO', fechaTransaccion: '2020-01-01T15:00:00-05:00' }
      ]);

      const cobros = component.cobrosDelDia();
      expect(cobros.length).toBe(1);
      expect(cobros[0].ordenId).toBe('888');
      expect(cobros[0].clienteNombre).toBe('');
      expect(cobros[0].tipoOrden).toBe('');

      const compSpy = spyOn(financeService, 'obtenerComprobantePorOrden').and.returnValue(of({
        id: 50, ordenId: 888, tipo: 'BOLETA', serieCorrelativo: 'B001-00000050',
        clienteNombre: 'Lucía', subtotal: 35.59, igv: 6.41, total: 42, estadoPagoTexto: 'PAGADO', emitidoEn: `${hoyLima}T15:01:00`
      }));
      component.reimprimirTicket(cobros[0]);
      expect(compSpy).toHaveBeenCalledWith('888');
      expect(component.ticketEmitido()?.comprobante?.serieCorrelativo).toBe('B001-00000050');
    });
  });
});
