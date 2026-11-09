import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroRecargaFondoModalComponent } from './cajero-recarga-fondo-modal.component';
import { BackendLiquidacionResponse } from '../../../core/models/api-contracts.model';

describe('CajeroRecargaFondoModalComponent', () => {
  let component: CajeroRecargaFondoModalComponent;
  let fixture: ComponentFixture<CajeroRecargaFondoModalComponent>;

  const mockLiq: BackendLiquidacionResponse = {
    id: 12,
    repartidorId: 5,
    repartidorNombre: 'Carlos Repartidor',
    arqueoCajaId: 1,
    fondoInicial: 50.0,
    totalCobradoEfectivo: 0,
    totalEsperadoEfectivo: 0,
    diferenciaEfectivo: 0,
    totalRendido: 0,
    diferencia: 0,
    estado: 'ABIERTA',
    creadoEn: '2026-11-09T10:00:00'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroRecargaFondoModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroRecargaFondoModalComponent);
    component = fixture.componentInstance;
  });

  it('calcula correctamente el nuevo fondo proyectado', () => {
    fixture.componentRef.setInput('liquidacion', mockLiq);
    component.monto.set(30);
    fixture.detectChanges();

    expect(component.nuevoFondoTotal()).toBe(80.0);
    expect(component.montoInvalido()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Carlos Repartidor');
    expect(fixture.nativeElement.textContent).toContain('80.00');
  });

  it('invalida el boton de confirmacion si el monto es menor o igual a cero', () => {
    fixture.componentRef.setInput('liquidacion', mockLiq);
    component.monto.set(0);
    fixture.detectChanges();

    expect(component.montoInvalido()).toBeTrue();
    const btnConfirmar = fixture.nativeElement.querySelector('button[disabled]');
    expect(btnConfirmar).toBeTruthy();
  });
});

