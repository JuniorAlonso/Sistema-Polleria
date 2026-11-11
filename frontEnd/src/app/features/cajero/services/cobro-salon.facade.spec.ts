import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CobroSalonFacade, ErrorCobro } from './cobro-salon.facade';
import { PaymentService } from '../../../core/services/payment.service';
import { FinanceService } from '../../../core/services/finance.service';
import { FinanceApiService } from '../../../core/api/finance-api.service';
import { OrdersService } from '../../../core/services/orders.service';
import { Order } from '../../../core/models/order.model';
import { PaymentTransaction } from '../../../core/models/payment.model';
import { consumidorFinal } from '../models/datos-fiscales';
import { BackendComprobanteResponse } from '../../../core/models/api-contracts.model';
import { ArqueoCaja } from '../../../core/models/finance.model';
import { PaymentMethod } from '../../../core/models/order.model';

describe('CobroSalonFacade (plan 03, 4.1 y D3.17)', () => {
  let facade: CobroSalonFacade;
  let pagos: jasmine.SpyObj<PaymentService>;
  let finanzas: jasmine.SpyObj<FinanceService>;
  let finanzasApi: jasmine.SpyObj<FinanceApiService>;
  let ordenes: jasmine.SpyObj<OrdersService>;

  const orden = { id: '101', codigoSeguimiento: 'POL-101', tipo: 'SALON', estado: 'LISTO', total: 45 } as unknown as Order;
  const comprobante = { id: 1, ordenId: 101, serieCorrelativo: 'B001-000007', total: 45 } as unknown as BackendComprobanteResponse;
  const pago = (estado: string) => ({ id: '9', estado } as PaymentTransaction);

  beforeEach(() => {
    pagos = jasmine.createSpyObj('PaymentService', ['obtenerPorOrden', 'iniciarPago', 'confirmarPago']);
    finanzas = jasmine.createSpyObj('FinanceService', ['registrarVentaEnCaja']);
    finanzasApi = jasmine.createSpyObj('FinanceApiService', ['obtenerCajaActual']);
    ordenes = jasmine.createSpyObj('OrdersService', ['completarOrdenSalon']);
    TestBed.configureTestingModule({
      providers: [
        CobroSalonFacade,
        { provide: PaymentService, useValue: pagos },
        { provide: FinanceService, useValue: finanzas },
        { provide: FinanceApiService, useValue: finanzasApi },
        { provide: OrdersService, useValue: ordenes }
      ]
    });
    facade = TestBed.inject(CobroSalonFacade);
    finanzasApi.obtenerCajaActual.and.returnValue(of({ estado: 'ABIERTA' } as unknown as ArqueoCaja));
    finanzas.registrarVentaEnCaja.and.returnValue(of(comprobante));
    ordenes.completarOrdenSalon.and.returnValue(of(orden));
  });

  function cobrar(metodo: 'EFECTIVO' | 'TARJETA' | 'YAPE_PLIN' = 'EFECTIVO') {
    let resultado: unknown;
    let error: ErrorCobro | undefined;
    facade.cobrar(orden, metodo, 'ref', consumidorFinal()).subscribe({
      next: r => (resultado = r),
      error: e => (error = e)
    });
    return { resultado: resultado as { comprobante: unknown } | undefined, error };
  }

  it('sin pago previo: inicia, confirma, emite con ingreso en efectivo y recién después cierra la orden', () => {
    pagos.obtenerPorOrden.and.returnValue(of(null));
    pagos.iniciarPago.and.returnValue(of(pago('PENDIENTE')));
    pagos.confirmarPago.and.returnValue(of(pago('APROBADO')));

    const { resultado } = cobrar('EFECTIVO');

    expect(pagos.iniciarPago).toHaveBeenCalledWith('101', 45, 'EFECTIVO' as unknown as PaymentMethod);
    expect(finanzas.registrarVentaEnCaja).toHaveBeenCalledWith('101', consumidorFinal(), true);
    expect(ordenes.completarOrdenSalon).toHaveBeenCalledWith('101', 'LISTO');
    expect(resultado?.comprobante).toBe(comprobante);
  });

  it('tarjeta y Yape no registran ingreso en caja ni consultan la caja', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('PENDIENTE')));
    pagos.confirmarPago.and.returnValue(of(pago('APROBADO')));

    cobrar('TARJETA');

    expect(finanzas.registrarVentaEnCaja).toHaveBeenCalledWith('101', consumidorFinal(), false);
    expect(finanzasApi.obtenerCajaActual).not.toHaveBeenCalled();
  });

  it('con el pago ya APROBADO no vuelve a cobrar: solo completa comprobante y cierre (reintento)', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('APROBADO')));

    const { resultado } = cobrar('EFECTIVO');

    expect(pagos.iniciarPago).not.toHaveBeenCalled();
    expect(pagos.confirmarPago).not.toHaveBeenCalled();
    expect(finanzas.registrarVentaEnCaja).toHaveBeenCalled();
    expect(ordenes.completarOrdenSalon).toHaveBeenCalled();
    expect(resultado).toBeTruthy();
  });

  it('reintento: un pago aprobado con tarjeta no registra ingreso aunque la pantalla diga efectivo (D3.13, R3.12)', () => {
    pagos.obtenerPorOrden.and.returnValue(of({ id: '9', estado: 'APROBADO', metodo: 'TARJETA' } as PaymentTransaction));

    cobrar('EFECTIVO');

    expect(finanzas.registrarVentaEnCaja).toHaveBeenCalledWith('101', consumidorFinal(), false);
    expect(finanzasApi.obtenerCajaActual).not.toHaveBeenCalled();
  });

  it('reintento: un pago aprobado en efectivo registra el ingreso aunque la pantalla diga tarjeta', () => {
    pagos.obtenerPorOrden.and.returnValue(of({ id: '9', estado: 'APROBADO', metodo: 'EFECTIVO_CONTRAENTREGA' } as PaymentTransaction));

    cobrar('TARJETA');

    expect(finanzas.registrarVentaEnCaja).toHaveBeenCalledWith('101', consumidorFinal(), true);
  });

  it('reintento: un pago aprobado en efectivo con la caja cerrada informa que el pago ya está aprobado', () => {
    pagos.obtenerPorOrden.and.returnValue(of({ id: '9', estado: 'APROBADO', metodo: 'EFECTIVO_CONTRAENTREGA' } as PaymentTransaction));
    finanzasApi.obtenerCajaActual.and.returnValue(throwError(() => ({ status: 404 })));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('CAJA');
    expect(error?.pagoAprobado).toBeTrue();
    expect(finanzas.registrarVentaEnCaja).not.toHaveBeenCalled();
  });

  it('en efectivo sin caja abierta no cobra nada (R3.7)', () => {
    finanzasApi.obtenerCajaActual.and.returnValue(throwError(() => ({ status: 404 })));
    pagos.obtenerPorOrden.and.returnValue(of(null));

    const { error } = cobrar('EFECTIVO');

    expect(error?.paso).toBe('CAJA');
    expect(error?.pagoAprobado).toBeFalse();
    expect(pagos.iniciarPago).not.toHaveBeenCalled();
    expect(finanzas.registrarVentaEnCaja).not.toHaveBeenCalled();
  });

  it('si la emisión falla, el pago queda aprobado y la orden NO se cierra', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('PENDIENTE')));
    pagos.confirmarPago.and.returnValue(of(pago('APROBADO')));
    finanzas.registrarVentaEnCaja.and.returnValue(throwError(() => ({ status: 409, error: { error: 'No hay una caja abierta' } })));

    const { error } = cobrar('EFECTIVO');

    expect(error?.paso).toBe('COMPROBANTE');
    expect(error?.pagoAprobado).toBeTrue();
    expect(error?.mensaje).toContain('caja abierta');
    expect(ordenes.completarOrdenSalon).not.toHaveBeenCalled();
  });

  it('si el cierre falla, informa el paso con el comprobante ya emitido', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('APROBADO')));
    ordenes.completarOrdenSalon.and.returnValue(throwError(() => ({ status: 409, error: { detail: 'Mesa no está POR_COBRAR' } })));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('CIERRE');
    expect(error?.pagoAprobado).toBeTrue();
    expect(error?.comprobante).toBe(comprobante);
  });

  it('un pago CANCELADO no se cobra', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('CANCELADO')));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('PAGO');
    expect(pagos.confirmarPago).not.toHaveBeenCalled();
  });

  it('si payments no confirma, se detiene antes del comprobante', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('PENDIENTE')));
    pagos.confirmarPago.and.returnValue(of(null));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('PAGO');
    expect(error?.pagoAprobado).toBeFalse();
    expect(finanzas.registrarVentaEnCaja).not.toHaveBeenCalled();
  });

  it('un 409 al confirmar un pago pendiente desactualizado muestra el motivo del backend', () => {
    pagos.obtenerPorOrden.and.returnValue(of(pago('PENDIENTE')));
    pagos.confirmarPago.and.returnValue(throwError(() => ({ status: 409, error: { detail: 'El monto S/ 40 no coincide con el total' } })));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('PAGO');
    expect(error?.pagoAprobado).toBeFalse();
    expect(error?.mensaje).toContain('no coincide');
    expect(finanzas.registrarVentaEnCaja).not.toHaveBeenCalled();
  });

  it('un 409 por monto distinto al iniciar se informa con el mensaje del backend', () => {
    pagos.obtenerPorOrden.and.returnValue(of(null));
    pagos.iniciarPago.and.returnValue(throwError(() => ({ status: 409, error: { detail: 'El monto S/ 45 no coincide' } })));

    const { error } = cobrar('TARJETA');

    expect(error?.paso).toBe('PAGO');
    expect(error?.mensaje).toContain('no coincide');
  });
});
