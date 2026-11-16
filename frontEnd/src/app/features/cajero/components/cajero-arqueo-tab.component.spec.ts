import { TestBed } from '@angular/core/testing';
import { CajeroArqueoTabComponent } from './cajero-arqueo-tab.component';
import { ArqueoCaja } from '../../../core/models/finance.model';

describe('CajeroArqueoTabComponent (D3.12: blind count)', () => {
  function render() {
    TestBed.configureTestingModule({ imports: [CajeroArqueoTabComponent] });
    const fixture = TestBed.createComponent(CajeroArqueoTabComponent);
    fixture.componentRef.setInput('cajaAbierta', true);
    fixture.componentRef.setInput('caja', { id: 1, estado: 'ABIERTA', montoApertura: 150 } as unknown as ArqueoCaja);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the opening float but not the expected drawer balance nor the income/expense totals', () => {
    const texto = render();

    expect(texto).toContain('Fondo Inicial Apertura');
    expect(texto).not.toContain('Saldo Teórico');
    expect(texto).not.toContain('Ingresos Extras');
    expect(texto).not.toContain('Egresos / Gastos Menores');
  });
});
