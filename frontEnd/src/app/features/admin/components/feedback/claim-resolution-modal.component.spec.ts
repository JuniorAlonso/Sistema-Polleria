import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClaimResolutionModalComponent } from './claim-resolution-modal.component';
import { ReporteIncidencia } from '../../../../core/models/feedback.model';
import { Order } from '../../../../core/models/order.model';

describe('ClaimResolutionModalComponent (FE-11)', () => {
  let fixture: ComponentFixture<ClaimResolutionModalComponent>;
  let component: ClaimResolutionModalComponent;

  const baseReclamo = (overrides: Partial<ReporteIncidencia> = {}): ReporteIncidencia => ({
    id: 7,
    ordenId: 90,
    clienteId: 1,
    motivo: 'COMIDA_FRIA',
    descripcion: 'Llegó frío',
    estado: 'ABIERTO',
    creadoEn: '2026-11-15T11:00:00',
    ...overrides
  });

  const baseOrden: Order = {
    id: '90',
    codigoSeguimiento: 'POL-90',
    cliente: { nombre: 'Luis', celular: '999111222' },
    items: [],
    subtotal: 42.37,
    costoEnvio: 0,
    descuento: 0,
    total: 50,
    estado: 'ENTREGADO',
    tipo: 'DELIVERY',
    metodoPago: 'YAPE',
    createdAt: '2026-11-15T10:30:00',
    updatedAt: '2026-11-15T10:45:00'
  };

  const setup = (reclamoOverrides: Partial<ReporteIncidencia> = {}, ordenes: Order[] = [baseOrden]) => {
    fixture = TestBed.createComponent(ClaimResolutionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('reclamo', baseReclamo(reclamoOverrides));
    fixture.componentRef.setInput('ordenes', ordenes);
    fixture.componentRef.setInput('fotoSrc', '');
    fixture.componentRef.setInput('isResolviendoReclamo', false);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimResolutionModalComponent]
    }).compileComponents();
  });

  it('inicializa montoReembolso en null (nunca 15.00) y respuestaAdmin vacía si no hay previa', () => {
    setup();

    expect((component as unknown as { resolucionForm: { getRawValue(): { montoReembolso: number | null; respuestaAdmin: string | null } } })
      .resolucionForm.getRawValue().montoReembolso).toBeNull();
    expect((component as unknown as { resolucionForm: { getRawValue(): { respuestaAdmin: string | null } } })
      .resolucionForm.getRawValue().respuestaAdmin).toBe('');
  });

  it('exige monto positivo <= total de orden cuando emitirReembolso está activo', () => {
    setup();
    const form = (component as unknown as {
      resolucionForm: { patchValue(v: Record<string, unknown>): void };
      isFormResolucionValido(): boolean;
    });

    form.resolucionForm.patchValue({
      estadoFinal: 'RESUELTO',
      respuestaAdmin: 'Procede reembolso parcial verificado',
      emitirReembolso: true,
      montoReembolso: null
    });
    expect(form.isFormResolucionValido()).toBeFalse();

    form.resolucionForm.patchValue({ montoReembolso: -10 });
    expect(form.isFormResolucionValido()).toBeFalse();

    form.resolucionForm.patchValue({ montoReembolso: 75 });
    expect(form.isFormResolucionValido()).toBeFalse();

    form.resolucionForm.patchValue({ montoReembolso: 30 });
    expect(form.isFormResolucionValido()).toBeTrue();
  });

  it('bloquea confirmación si el reclamo ya está en estado terminal RESUELTO o RECHAZADO', () => {
    setup({ estado: 'RESUELTO', respuestaAdmin: 'Ya resuelto antes' });
    const confirmedSpy = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(confirmedSpy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const confirmBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(confirmBtn.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('no puede volver a resolverse');

    confirmBtn.click();
    expect(confirmedSpy).not.toHaveBeenCalled();
  });
});
