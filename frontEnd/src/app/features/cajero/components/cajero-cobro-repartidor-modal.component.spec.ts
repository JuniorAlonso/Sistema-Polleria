import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CajeroCobroRepartidorModalComponent } from './cajero-cobro-repartidor-modal.component';
import { FinanceService } from '../../../core/services/finance.service';
import { Repartidor } from '../../../core/services/repartidores.service';
import { BackendCobroRepartidorResponse, BackendEfectivoPendienteLiquidacion } from '../../../core/models/api-contracts.model';

describe('CajeroCobroRepartidorModalComponent', () => {
  let component: CajeroCobroRepartidorModalComponent;
  let fixture: ComponentFixture<CajeroCobroRepartidorModalComponent>;
  let financeService: FinanceService;

  const mockRepartidores: Repartidor[] = [
    { id: 9, nombre: 'Motorizado San Pollo', email: 'motorizado@sanpollo.com', telefono: '999888777' },
    { id: 10, nombre: 'Pedro Delivery', email: 'pedro@sanpollo.com', telefono: '999111222' }
  ];

  const mockPendiente: BackendEfectivoPendienteLiquidacion = {
    repartidorId: 9,
    liquidacionId: 1,
    desde: '2026-11-08T10:00:00',
    total: 150.00,
    cantidad: 3,
    pagos: [],
    totalCobrado: 200.00,
    totalRendido: 50.00
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroCobroRepartidorModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroCobroRepartidorModalComponent);
    component = fixture.componentInstance;
    financeService = TestBed.inject(FinanceService);

    fixture.componentRef.setInput('repartidores', mockRepartidores);
    fixture.detectChanges();
  });

  it('debe crearse y tener el botón de cobro deshabilitado si no se ha seleccionado repartidor', () => {
    expect(component).toBeTruthy();
    expect(component.botonDeshabilitado()).toBeTrue();
    expect(component.mensajeBloqueo()).toBe('Selecciona un repartidor para continuar.');
  });

  it('al seleccionar un repartidor consulta su saldo en el backend', () => {
    spyOn(financeService, 'obtenerEfectivoPendienteLiquidacion').and.returnValue(of(mockPendiente));

    component.onRepartidorChange(9);

    expect(financeService.obtenerEfectivoPendienteLiquidacion).toHaveBeenCalledWith(9);
    expect(component.saldoInfo()).toEqual(mockPendiente);
    expect(component.monto()).toBe(150.00); // atajo automático si monto era 0
    expect(component.botonDeshabilitado()).toBeFalse();
  });

  it('el atajo "Cobrar Todo" fija el monto exacto al saldo pendiente', () => {
    component.saldoInfo.set(mockPendiente);
    component.monto.set(20.00);

    component.cobrarTotal();

    expect(component.monto()).toBe(150.00);
  });

  it('bloquea el cobro si el monto excede el saldo pendiente', () => {
    component.repartidorId.set(9);
    component.saldoInfo.set(mockPendiente);
    component.monto.set(160.00);

    expect(component.mensajeBloqueo()).toContain('supera el saldo pendiente');
    expect(component.botonDeshabilitado()).toBeTrue();
  });

  it('ejecuta el cobro exitosamente y emite cobroExitoso', () => {
    const mockRes: BackendCobroRepartidorResponse = {
      id: 77,
      repartidorId: 9,
      monto: 50.00,
      arqueoCajaId: 1,
      cobradoPor: 2,
      fecha: '2026-11-08T20:00:00',
      liquidacionId: 1,
      saldoRestante: 100.00
    };

    spyOn(financeService, 'registrarCobroRepartidor').and.returnValue(of(mockRes));
    let emitido = false;
    component.cobroExitoso.subscribe(() => emitido = true);

    component.repartidorId.set(9);
    component.saldoInfo.set(mockPendiente);
    component.monto.set(50.00);
    component.observaciones.set('Abono parcial de tarde');

    component.ejecutarCobro();

    expect(financeService.registrarCobroRepartidor).toHaveBeenCalledWith({
      repartidorId: 9,
      repartidorNombre: 'Motorizado San Pollo',
      monto: 50.00,
      observaciones: 'Abono parcial de tarde'
    });
    expect(emitido).toBeTrue();
  });
});

