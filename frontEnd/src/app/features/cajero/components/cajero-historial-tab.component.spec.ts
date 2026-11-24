import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroHistorialTabComponent } from './cajero-historial-tab.component';
import { CobroDelDia } from '../models/cajero.models';
import { EnvioSunatResponse } from '../../../core/api/facturacion-sunat-api.service';
import { BackendComprobanteResponse } from '../../../core/models/api-contracts.model';

describe('CajeroHistorialTabComponent', () => {
  let fixture: ComponentFixture<CajeroHistorialTabComponent>;
  let component: CajeroHistorialTabComponent;

  const cobro = (over: Partial<CobroDelDia> = {}): CobroDelDia => ({
    id: 1,
    fechaHora: '2026-11-23T20:00:00',
    ordenId: 'ord-123',
    codigoOrden: '123',
    clienteNombre: 'Ana',
    tipoOrden: 'SALON',
    metodo: 'EFECTIVO',
    monto: 47.2,
    referencia: 'OK',
    items: [],
    cajero: 'Caja 1',
    ...over
  });

  const envio = (over: Partial<EnvioSunatResponse> = {}): EnvioSunatResponse => ({
    ordenId: 123,
    comprobanteId: 5,
    tipo: 'BOLETA',
    serieNumero: 'B001-5',
    nombreArchivo: '20608945123-03-B001-5',
    estado: 'ACEPTADO',
    codigoRespuesta: '0',
    descripcion: 'Aceptada',
    observaciones: null,
    hash: 'h==',
    total: 47.2,
    intentos: 1,
    enviadoEn: '2026-11-23T20:01:00',
    tieneCdr: true,
    ...over
  });

  const comprobante = (over: Partial<BackendComprobanteResponse> = {}): BackendComprobanteResponse => ({
    id: 5,
    ordenId: 123,
    tipo: 'BOLETA',
    serieCorrelativo: 'B001-000005',
    clienteNombre: 'Ana',
    subtotal: 40,
    igv: 7.2,
    total: 47.2,
    estadoPagoTexto: 'PAGADO',
    emitidoEn: '2026-11-23T20:00:00',
    anulado: false,
    ...over
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CajeroHistorialTabComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(CajeroHistorialTabComponent);
    component = fixture.componentInstance;
  });

  it('normaliza ord-123, muestra QR/XML/CDR cuando está ACEPTADO y emite eventos', () => {
    const qrEvents: number[] = [];
    component.verTicketSunat.subscribe(id => qrEvents.push(id));

    fixture.componentRef.setInput('cobros', [cobro()]);
    fixture.componentRef.setInput('enviosPorOrden', new Map([[123, envio()]]));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('ACEPTADO');
    expect(el.textContent).toContain('QR');
    expect(el.textContent).toContain('XML');
    expect(el.textContent).toContain('CDR');

    const btnQr = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'QR') as HTMLButtonElement;
    btnQr.click();
    expect(qrEvents).toEqual([123]);
  });

  it('oculta Enviar a SUNAT si comprobantesPorOrden indica sin comprobante o anulado', () => {
    fixture.componentRef.setInput('cobros', [
      cobro({ id: 1, ordenId: '100', codigoOrden: '100' }),
      cobro({ id: 2, ordenId: '101', codigoOrden: '101' })
    ]);
    fixture.componentRef.setInput('comprobantesPorOrden', new Map([
      [101, comprobante({ ordenId: 101, anulado: true })]
    ]));
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sin comprobante');
    expect(text).toContain('Anulado');
    expect(text).not.toContain('Enviar a SUNAT');
  });
});
