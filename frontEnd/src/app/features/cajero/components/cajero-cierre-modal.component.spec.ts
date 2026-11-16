import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroCierreModalComponent } from './cajero-cierre-modal.component';

describe('CajeroCierreModalComponent', () => {
  let component: CajeroCierreModalComponent;
  let fixture: ComponentFixture<CajeroCierreModalComponent>;

  const MENSAJE_400 =
    'El efectivo contado no coincide con el esperado. Vuelve a contar o indica el motivo en las observaciones.';

  const confirmarBtn = (): HTMLButtonElement =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(b => (b.textContent || '').includes('Confirmar'))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroCierreModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroCierreModalComponent);
    component = fixture.componentInstance;
  });

  it('S6: blind count starts empty, hides expected amount and difference, and cannot confirm without a count', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const efectivo = fixture.nativeElement.querySelector('[data-testid="cierre-efectivo"]') as HTMLInputElement;
    const observaciones = fixture.nativeElement.querySelector('[data-testid="cierre-observaciones"]') as HTMLTextAreaElement;
    const texto = fixture.nativeElement.textContent as string;

    expect(component.efectivo()).toBeNull();
    expect(efectivo.value).toBe('');
    expect(observaciones.value).toBe('');
    expect(texto).not.toMatch(/Esperado|Teórico|Cuadre Exacto|Sobrante|Faltante/);
    expect(confirmarBtn().disabled).toBeTrue();

    component.efectivo.set(120);
    fixture.detectChanges();
    expect(confirmarBtn().disabled).toBeFalse();
  });

  it('S6: after a 400 the backend message is shown and a reason is required before confirming again', () => {
    const emitido = jasmine.createSpy('confirmar');
    component.confirmar.subscribe(emitido);
    component.efectivo.set(100);
    fixture.componentRef.setInput('error', MENSAJE_400);
    fixture.componentRef.setInput('motivoObligatorio', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="cierre-error"]').textContent).toContain(MENSAJE_400);
    expect(confirmarBtn().disabled).withContext('no reason yet').toBeTrue();

    component.observaciones.set('   ');
    fixture.detectChanges();
    expect(confirmarBtn().disabled).withContext('blank reason').toBeTrue();

    component.observaciones.set('Billete de S/ 20 mal contado');
    fixture.detectChanges();
    expect(confirmarBtn().disabled).toBeFalse();
    confirmarBtn().click();
    expect(emitido).toHaveBeenCalledTimes(1);
  });
});
