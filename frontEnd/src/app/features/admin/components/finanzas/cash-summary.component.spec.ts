import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashSummaryComponent } from './cash-summary.component';
import { ArqueoCaja, BalanceDiario } from '../../../../core/models/finance.model';

describe('CashSummaryComponent', () => {
  let fixture: ComponentFixture<CashSummaryComponent>;

  const caja: ArqueoCaja = {
    id: 7, usuarioId: 1, usuarioNombre: 'Admin', montoApertura: 200, montoInicial: 200,
    ventasEfectivo: 350, ventasDigital: 90, estado: 'ABIERTA', fechaApertura: '2026-11-11T08:00:00'
  };

  const balance: BalanceDiario = {
    fecha: '2026-11-11',
    ingresos: { pasarelaDigital: 120.5, efectivoSalon: 432.1, posFisicoSalon: 40, totalIngresos: 592.6 },
    egresos: { reembolsosEmitidos: 0, gastosCajaChica: 25, totalEgresos: 25 },
    balanceNeto: 567.6,
    ordenesAtendidas: 12,
    ticketPromedio: 49.38
  };

  const text = (testId: string): string =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CashSummaryComponent] }).compileComponents();
    fixture = TestBed.createComponent(CashSummaryComponent);
    fixture.componentRef.setInput('cajaActual', caja);
    fixture.componentRef.setInput('balanceDiario', balance);
    fixture.detectChanges();
  });

  it('shows the daily balance figures instead of the register totals', () => {
    expect(text('summary-total')).toBe('S/ 592.60');
    expect(text('summary-cash')).toBe('S/ 432.10');
    expect(text('summary-digital')).toBe('S/ 160.50');
    expect(text('summary-net')).toBe('S/ 567.60');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gastos: S/ 25.00');
  });

  it('does not claim a reconciliation with orders-service', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Conciliado con orders-service');
  });

  it('shows zeros when there is no balance yet', () => {
    fixture.componentRef.setInput('balanceDiario', null);
    fixture.detectChanges();

    expect(text('summary-total')).toBe('S/ 0.00');
    expect(text('summary-cash')).toBe('S/ 0.00');
    expect(text('summary-digital')).toBe('S/ 0.00');
  });
});
