import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CashCloseModalComponent, CierreCajaDraft } from './cash-close-modal.component';
import { ArqueoCaja } from '../../../../core/models/finance.model';
import { CierreCajaForm } from '../../models/admin-forms';

describe('CashCloseModalComponent', () => {
  let fixture: ComponentFixture<CashCloseModalComponent>;
  let emitted: CierreCajaForm[];

  const caja: ArqueoCaja = {
    id: 7, usuarioId: 1, usuarioNombre: 'Admin', montoApertura: 200, montoInicial: 200,
    ventasEfectivo: 350, estado: 'ABIERTA', fechaApertura: '2026-11-11T08:00:00'
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const inputs = (): HTMLInputElement[] => Array.from(el().querySelectorAll('input')) as HTMLInputElement[];
  const confirmButton = (): HTMLButtonElement => Array.from(el().querySelectorAll('button'))
    .find(b => b.textContent?.includes('Cerrar y Cuadrar Caja')) as HTMLButtonElement;

  async function setup(initial: CierreCajaDraft, errorMessage: string | null = null): Promise<void> {
    await TestBed.configureTestingModule({ imports: [CashCloseModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(CashCloseModalComponent);
    fixture.componentRef.setInput('cajaActual', caja);
    fixture.componentRef.setInput('initial', initial);
    fixture.componentRef.setInput('errorMessage', errorMessage);
    emitted = [];
    fixture.componentInstance.confirmed.subscribe(v => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function typeCount(value: string): Promise<void> {
    inputs()[0].value = value;
    inputs()[0].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('does not show the expected cash or difference before confirming', async () => {
    await setup({ efectivoReal: null, observaciones: '' });

    expect(el().textContent).not.toContain('Esperado');
    expect(el().textContent).not.toContain('550.00');
    expect(el().textContent).not.toContain('350.00');
  });

  it('blocks confirming with an empty count', async () => {
    await setup({ efectivoReal: null, observaciones: '' });

    expect(inputs()[0].value).toBe('');
    expect(confirmButton().disabled).toBeTrue();
    confirmButton().click();
    expect(emitted).toEqual([]);
  });

  it('blocks confirming with a negative count', async () => {
    await setup({ efectivoReal: null, observaciones: '' });
    await typeCount('-1');

    expect(confirmButton().disabled).toBeTrue();
    expect(el().textContent).toContain('El efectivo contado no puede ser negativo.');
  });

  it('emits the counted cash and observations when valid, zero included', async () => {
    await setup({ efectivoReal: null, observaciones: '' });
    await typeCount('0');
    inputs()[1].value = 'Faltante por vuelto';
    inputs()[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(confirmButton().disabled).toBeFalse();
    confirmButton().click();
    expect(emitted).toEqual([{ efectivoReal: 0, observaciones: 'Faltante por vuelto' }]);
  });

  it('shows the backend error message it receives', async () => {
    await setup({ efectivoReal: 540, observaciones: '' }, 'El efectivo contado no coincide con el esperado.');

    expect(inputs()[0].value).toBe('540');
    expect(el().textContent).toContain('El efectivo contado no coincide con el esperado.');
  });
});
