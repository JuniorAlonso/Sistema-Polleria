import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SunatBillingPanelComponent } from './sunat-billing-panel.component';
import { BackendComprobanteResponse } from '../../../../core/models/api-contracts.model';
import { EnvioSunatResponse } from '../../../../core/api/facturacion-sunat-api.service';

describe('SunatBillingPanelComponent', () => {
  let fixture: ComponentFixture<SunatBillingPanelComponent>;
  let component: SunatBillingPanelComponent;

  const comprobante = (over: Partial<BackendComprobanteResponse> = {}): BackendComprobanteResponse => ({
    id: 1,
    ordenId: 10,
    tipo: 'BOLETA',
    serieCorrelativo: 'B001-000010',
    clienteTipoDoc: 'DNI',
    clienteNumDoc: '12345678',
    clienteNombre: 'Juan Pérez',
    subtotal: 42.37,
    igv: 7.63,
    total: 50,
    estadoPagoTexto: 'PAGADO',
    emitidoEn: '2026-11-23T20:00:00',
    anulado: false,
    ...over
  });

  const envio = (over: Partial<EnvioSunatResponse> = {}): EnvioSunatResponse => ({
    ordenId: 10,
    comprobanteId: 1,
    tipo: 'BOLETA',
    serieNumero: 'B001-10',
    nombreArchivo: '20608945123-03-B001-10',
    estado: 'ACEPTADO',
    codigoRespuesta: '0',
    descripcion: 'Aceptada',
    observaciones: null,
    hash: 'hash==',
    total: 50,
    intentos: 1,
    enviadoEn: '2026-11-23T20:01:00',
    tieneCdr: true,
    ...over
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SunatBillingPanelComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(SunatBillingPanelComponent);
    component = fixture.componentInstance;
  });

  it('excluye comprobantes anulados de pendientes/observados y los clasifica como Anulado', () => {
    fixture.componentRef.setInput('comprobantesEmitidos', [
      comprobante({ ordenId: 10 }),
      comprobante({ ordenId: 11, serieCorrelativo: 'B001-000011', anulado: true }),
      comprobante({ ordenId: 12, tipo: 'FACTURA', serieCorrelativo: 'F001-000012' })
    ]);
    fixture.componentRef.setInput('envios', [envio({ ordenId: 10 })]);
    fixture.detectChanges();

    expect(component.kpis()).toEqual({
      total: 3,
      aceptados: 1,
      pendientesOObservados: 1,
      conError: 0
    });

    component.filtroEstado.set('SIN_ENVIAR');
    fixture.detectChanges();
    expect(component.filasFiltradas().map(f => f.ordenId)).toEqual([12]);
  });

  it('permite reintentar en estado ENVIANDO, filtra por tipo/búsqueda y muestra banner de error', () => {
    const emitidos: number[] = [];
    component.enviarSunat.subscribe(id => emitidos.push(id));

    fixture.componentRef.setInput('error', 'No se pudo consultar envíos');
    fixture.componentRef.setInput('comprobantesEmitidos', [
      comprobante({ ordenId: 20, tipo: 'FACTURA', serieCorrelativo: 'F001-000020', clienteNombre: 'Pollería SAC' })
    ]);
    fixture.componentRef.setInput('envios', [
      envio({ ordenId: 20, tipo: 'FACTURA', serieNumero: 'F001-20', estado: 'ENVIANDO', tieneCdr: false })
    ]);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('No se pudo consultar envíos');

    const btnReintentar = Array.from(html.querySelectorAll('tbody button'))
      .find(b => b.textContent?.trim() === 'Reintentar') as HTMLButtonElement;
    expect(btnReintentar).toBeTruthy();
    btnReintentar.click();
    expect(emitidos).toEqual([20]);
  });
});
