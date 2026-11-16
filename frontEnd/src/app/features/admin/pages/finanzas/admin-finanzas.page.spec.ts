import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminFinanzasPage } from './admin-finanzas.page';
import { AuthService } from '../../../../core/services/auth.service';
import { FinanceService } from '../../../../core/services/finance.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RepartidoresService } from '../../../../core/services/repartidores.service';
import { ArqueoCaja, BalanceDiario, MovimientoCaja } from '../../../../core/models/finance.model';

describe('AdminFinanzasPage', () => {
  let fixture: ComponentFixture<AdminFinanzasPage>;
  let financeStub: {
    cajaActual: ReturnType<typeof signal<ArqueoCaja | null>>;
    balanceDiario: ReturnType<typeof signal<BalanceDiario | null>>;
    movimientos: ReturnType<typeof signal<MovimientoCaja[]>>;
    cargarCajaActual: jasmine.Spy;
    cargarBalanceDiario: jasmine.Spy;
    cargarMovimientos: jasmine.Spy;
    cerrarCaja: jasmine.Spy;
    abrirCaja: jasmine.Spy;
    registrarMovimiento: jasmine.Spy;
  };
  let notifyStub: jasmine.SpyObj<NotificationService>;

  const cajaAbierta: ArqueoCaja = {
    id: 7,
    usuarioId: 1,
    usuarioNombre: 'Admin',
    montoApertura: 200,
    montoInicial: 200,
    ventasEfectivo: 350,
    ventasDigital: 90,
    estado: 'ABIERTA',
    fechaApertura: '2026-11-11T08:00:00'
  };

  const balance: BalanceDiario = {
    fecha: '2026-11-11',
    ingresos: { pasarelaDigital: 120.5, efectivoSalon: 432.1, posFisicoSalon: 40, totalIngresos: 592.6 },
    egresos: { reembolsosEmitidos: 0, gastosCajaChica: 25, totalEgresos: 25 },
    balanceNeto: 567.6,
    ordenesAtendidas: 12,
    ticketPromedio: 49.38,
    totalVentas: 592.6,
    saldoNeto: 567.6,
    totalGastos: 25
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const closeModal = (): HTMLElement | null => el().querySelector('app-cash-close-modal');

  function openCloseModal(): void {
    const button = Array.from(el().querySelectorAll('app-cash-header button'))
      .find(b => b.textContent?.includes('Arqueo y Cierre de Turno')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  }

  function typeInto(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    financeStub = {
      cajaActual: signal<ArqueoCaja | null>(cajaAbierta),
      balanceDiario: signal<BalanceDiario | null>(balance),
      movimientos: signal<MovimientoCaja[]>([]),
      cargarCajaActual: jasmine.createSpy('cargarCajaActual'),
      cargarBalanceDiario: jasmine.createSpy('cargarBalanceDiario'),
      cargarMovimientos: jasmine.createSpy('cargarMovimientos'),
      cerrarCaja: jasmine.createSpy('cerrarCaja'),
      abrirCaja: jasmine.createSpy('abrirCaja'),
      registrarMovimiento: jasmine.createSpy('registrarMovimiento')
    };
    notifyStub = jasmine.createSpyObj<NotificationService>('NotificationService', ['showSuccess', 'showError', 'showWarning']);

    await TestBed.configureTestingModule({
      imports: [AdminFinanzasPage],
      providers: [
        { provide: FinanceService, useValue: financeStub },
        { provide: NotificationService, useValue: notifyStub },
        { provide: AuthService, useValue: { currentUser: signal({ nombre: 'Admin' }) } },
        { provide: RepartidoresService, useValue: { repartidores: signal([]), cargar: jasmine.createSpy('cargar') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFinanzasPage);
    fixture.detectChanges();
  });

  it('renders the daily balance cash figure and no reconciliation legend', () => {
    const text = el().querySelector('app-cash-summary')!.textContent ?? '';

    expect(text).not.toContain('Conciliado con orders-service');
    expect(text).toContain('432.10');
    expect(text).toContain('592.60');
    expect(text).not.toContain('350.00');
  });

  it('opens the close modal with an empty count and empty observations', () => {
    openCloseModal();

    const modal = closeModal();
    expect(modal).not.toBeNull();
    const [conteo, observaciones] = Array.from(modal!.querySelectorAll('input')) as HTMLInputElement[];
    expect(conteo.value).toBe('');
    expect(observaciones.value).toBe('');
    expect(modal!.textContent).not.toContain('sin novedades');
    expect(modal!.textContent).not.toContain('550.00');
  });

  it('keeps the modal open and shows the backend message when closing answers 400', async () => {
    const backendMessage = 'El efectivo contado no coincide con el esperado. Vuelve a contar o indica el motivo en las observaciones.';
    financeStub.cerrarCaja.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { error: backendMessage } })));
    openCloseModal();
    await fixture.whenStable();

    const [conteo] = Array.from(closeModal()!.querySelectorAll('input')) as HTMLInputElement[];
    typeInto(conteo, '540');
    fixture.detectChanges();
    await fixture.whenStable();
    const confirmButton = Array.from(closeModal()!.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Cerrar y Cuadrar Caja')) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    expect(financeStub.cerrarCaja).toHaveBeenCalledWith(540, '');
    expect(closeModal()).not.toBeNull();
    expect(closeModal()!.textContent).toContain(backendMessage);
    expect(notifyStub.showError).toHaveBeenCalledWith(backendMessage);
    expect(financeStub.cargarBalanceDiario).toHaveBeenCalledTimes(1);
  });

  it('closes the modal and refreshes balance, register and movements on success', async () => {
    financeStub.cerrarCaja.and.returnValue(of({ ...cajaAbierta, estado: 'CERRADA', diferencia: 0, discrepancia: 0 }));
    openCloseModal();
    await fixture.whenStable();

    const [conteo] = Array.from(closeModal()!.querySelectorAll('input')) as HTMLInputElement[];
    typeInto(conteo, '550');
    fixture.detectChanges();
    await fixture.whenStable();
    const confirmButton = Array.from(closeModal()!.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Cerrar y Cuadrar Caja')) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    expect(financeStub.cerrarCaja).toHaveBeenCalledWith(550, '');
    expect(closeModal()).toBeNull();
    expect(financeStub.cargarBalanceDiario).toHaveBeenCalledTimes(2);
    expect(financeStub.cargarCajaActual).toHaveBeenCalledTimes(2);
    expect(financeStub.cargarMovimientos).toHaveBeenCalledTimes(2);
  });
});
