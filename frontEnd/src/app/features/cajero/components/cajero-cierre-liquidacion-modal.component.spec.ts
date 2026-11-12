import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroCierreLiquidacionModalComponent } from './cajero-cierre-liquidacion-modal.component';
import { BackendEfectivoPendienteLiquidacion, BackendLiquidacionResponse } from '../../../core/models/api-contracts.model';

describe('CajeroCierreLiquidacionModalComponent', () => {
  let component: CajeroCierreLiquidacionModalComponent;
  let fixture: ComponentFixture<CajeroCierreLiquidacionModalComponent>;

  const liq: BackendLiquidacionResponse = {
    id: 12,
    repartidorId: 5,
    repartidorNombre: 'Carlos Repartidor',
    fondoInicial: 50,
    totalCobradoEfectivo: 0,
    totalRendido: 0,
    diferencia: 0,
    estado: 'ABIERTA',
    creadoEn: '2026-11-09T10:00:00'
  };

  const pendiente: BackendEfectivoPendienteLiquidacion = {
    repartidorId: 5,
    liquidacionId: 12,
    desde: '2026-11-09T10:00:00',
    total: 35.5,
    cantidad: 2,
    pagos: []
  };

  const confirmarBtn = (): HTMLButtonElement =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(b => (b.textContent || '').includes('Cerrar y Cuadrar'))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroCierreLiquidacionModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroCierreLiquidacionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('liquidacion', liq);
  });

  it('S7: shows the cash collected on route and the expected total from /pendiente', () => {
    fixture.componentRef.setInput('pendiente', pendiente);
    component.totalRendido.set(85.5);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('35.50');
    expect(texto).toContain('85.50');
    expect(texto).toContain('Cuadre Exacto');
    expect(confirmarBtn().disabled).toBeFalse();
  });

  it('S7: when /pendiente fails it shows the error, no expected amount, and cannot confirm', () => {
    fixture.componentRef.setInput('errorPendiente', 'finance caído');
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('[data-testid="cierre-liq-error"]').textContent).toContain('finance caído');
    expect(texto).not.toContain('Cuadre Exacto');
    expect(texto).not.toContain('Faltante');
    expect(confirmarBtn().disabled).toBeTrue();
  });

  it('S7: cannot confirm while /pendiente is still loading', () => {
    fixture.componentRef.setInput('cargandoPendiente', true);
    fixture.detectChanges();

    expect(confirmarBtn().disabled).toBeTrue();
  });
});
