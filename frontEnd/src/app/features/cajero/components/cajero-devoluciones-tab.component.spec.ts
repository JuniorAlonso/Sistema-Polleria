import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroDevolucionesTabComponent } from './cajero-devoluciones-tab.component';
import { ReporteIncidencia } from '../../../core/models/feedback.model';

describe('CajeroDevolucionesTabComponent (FE-01)', () => {
  let fixture: ComponentFixture<CajeroDevolucionesTabComponent>;
  let component: CajeroDevolucionesTabComponent;

  const devolucion: ReporteIncidencia = {
    id: 42,
    ordenId: 108,
    clienteId: 1,
    clienteNombre: 'Ana Salas',
    motivo: 'PEDIDO_INCOMPLETO',
    descripcion: 'Faltó gaseosa',
    estado: 'RESUELTO',
    montoReembolso: 12,
    respuestaAdmin: 'Aprobado en ventanilla',
    creadoEn: '2026-11-15T10:00:00'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroDevolucionesTabComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CajeroDevolucionesTabComponent);
    component = fixture.componentInstance;
  });

  it('deshabilita Entregar Efectivo y bloquea emisión cuando procesando es true', () => {
    const entregarSpy = jasmine.createSpy('entregar');
    component.entregar.subscribe(entregarSpy);

    fixture.componentRef.setInput('devoluciones', [devolucion]);
    fixture.componentRef.setInput('procesando', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const btnEntregar = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(btnEntregar.disabled).toBeTrue();

    btnEntregar.click();
    expect(entregarSpy).not.toHaveBeenCalled();
  });

  it('emite el id del reclamo al hacer clic en Entregar Efectivo cuando no procesa', () => {
    const entregarSpy = jasmine.createSpy('entregar');
    component.entregar.subscribe(entregarSpy);

    fixture.componentRef.setInput('devoluciones', [devolucion]);
    fixture.componentRef.setInput('procesando', false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const btnEntregar = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(btnEntregar.disabled).toBeFalse();

    btnEntregar.click();
    expect(entregarSpy).toHaveBeenCalledWith(42);
  });
});
