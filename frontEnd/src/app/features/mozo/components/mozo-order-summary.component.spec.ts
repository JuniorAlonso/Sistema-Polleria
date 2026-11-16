import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MozoOrderSummaryComponent } from './mozo-order-summary.component';
import { ComandaItem } from '../mozo.types';

describe('MozoOrderSummaryComponent (FE-02, FE-13)', () => {
  let fixture: ComponentFixture<MozoOrderSummaryComponent>;
  let component: MozoOrderSummaryComponent;

  const sampleItems: ComandaItem[] = [{
    producto: {
      id: '1',
      nombre: '1/4 Pollo',
      descripcion: 'Clásico',
      precio: 22,
      categoria: 'POLLOS_A_LA_BRASA',
      imagenUrl: '',
      agotado: false
    },
    cantidad: 1,
    notas: ''
  }];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MozoOrderSummaryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MozoOrderSummaryComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mesaTitulo', 4);
    fixture.componentRef.setInput('items', sampleItems);
    fixture.componentRef.setInput('total', 22);
  });

  it('no inventa el nombre "Yovana M." cuando userName está vacío (FE-13)', () => {
    fixture.componentRef.setInput('userName', null);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Mozo: —');
    expect(text).not.toContain('Yovana M.');
  });

  it('deshabilita el botón de envío y muestra indicador cuando procesando es true (FE-02)', () => {
    const enviarSpy = jasmine.createSpy('enviar');
    component.enviar.subscribe(enviarSpy);

    fixture.componentRef.setInput('procesando', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const submitBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(submitBtn.disabled).toBeTrue();
    expect(submitBtn.textContent).toContain('Enviando comanda...');

    submitBtn.click();
    expect(enviarSpy).not.toHaveBeenCalled();
  });

  it('emite enviar cuando hay items y procesando es false', () => {
    const enviarSpy = jasmine.createSpy('enviar');
    component.enviar.subscribe(enviarSpy);

    fixture.componentRef.setInput('procesando', false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const submitBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(submitBtn.disabled).toBeFalse();
    submitBtn.click();
    expect(enviarSpy).toHaveBeenCalledTimes(1);
  });
});
