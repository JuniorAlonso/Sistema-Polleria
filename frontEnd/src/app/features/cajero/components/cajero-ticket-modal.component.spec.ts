import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CajeroTicketModalComponent, TicketComprobanteVista } from './cajero-ticket-modal.component';
import { BackendComprobanteResponse } from '../../../core/models/api-contracts.model';

describe('CajeroTicketModalComponent (S8: real receipt values)', () => {
  let fixture: ComponentFixture<CajeroTicketModalComponent>;

  const comprobante = (over: Partial<BackendComprobanteResponse> = {}): BackendComprobanteResponse => ({
    id: 9,
    ordenId: 77,
    tipo: 'BOLETA',
    serieCorrelativo: 'B001-00000123',
    clienteNombre: 'Ana Pérez',
    subtotal: 42.37,
    igv: 7.63,
    total: 50,
    estadoPagoTexto: 'PAGADO',
    emitidoEn: '2026-11-11T12:00:00',
    ...over
  });

  const ticket = (over: Partial<TicketComprobanteVista> = {}): TicketComprobanteVista => ({
    ordenId: 77,
    fechaHora: '2026-11-11T12:00:00',
    cajero: 'Caja 1',
    cliente: 'Ana Pérez',
    tipo: 'SALON',
    items: [],
    total: 50,
    metodo: 'EFECTIVO',
    efectivoRecibido: 60,
    vuelto: 10,
    ...over
  });

  const render = (t: TicketComprobanteVista): string => {
    fixture = TestBed.createComponent(CajeroTicketModalComponent);
    fixture.componentRef.setInput('ticket', t);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CajeroTicketModalComponent] }).compileComponents();
  });

  it('shows the emitted boleta series, subtotal, IGV and total, never a fake series or ELECTRÓNICA', () => {
    const texto = render(ticket({ comprobante: comprobante() }));
    expect(texto).toContain('BOLETA DE VENTA');
    expect(texto).toContain('B001-00000123');
    expect(texto).toContain('S/ 42.37');
    expect(texto).toContain('S/ 7.63');
    expect(texto).toContain('S/ 50.00');
    expect(texto).not.toContain('ELECTRÓNICA');
    expect(texto).not.toContain('B001-77');
    expect(texto).not.toContain('pendiente');
  });

  it('labels a factura as FACTURA with its own series and the fiscal client', () => {
    const texto = render(ticket({
      comprobante: comprobante({
        tipo: 'FACTURA', serieCorrelativo: 'F001-00000004', clienteNombre: 'Pollos SAC',
        clienteTipoDoc: 'RUC', clienteNumDoc: '20123456789'
      })
    }));
    expect(texto).toContain('FACTURA');
    expect(texto).not.toContain('BOLETA');
    expect(texto).toContain('F001-00000004');
    expect(texto).toContain('Pollos SAC');
    expect(texto).toContain('20123456789');
    expect(texto).not.toContain('ELECTRÓNICA');
  });

  it('says the receipt is pending and invents no series or IGV when none was emitted', () => {
    const texto = render(ticket({ comprobante: null }));
    expect(texto).toContain('Comprobante pendiente');
    expect(texto).not.toContain('B001-');
    expect(texto).not.toContain('OP. GRAVADA');
    expect(texto).not.toContain('I.G.V.');
    expect(texto).not.toContain('ELECTRÓNICA');
    expect(texto).not.toContain('Enviar a SUNAT');
    expect(texto).toContain('S/ 50.00');
  });

  it('muestra acciones SUNAT cuando hay comprobante emitido y descarga QR/XML/CDR cuando fue aceptado', () => {
    const textoSinEnviar = render(ticket({ comprobante: comprobante() }));
    expect(textoSinEnviar).toContain('Sin enviar a SUNAT');
    expect(textoSinEnviar).toContain('Enviar a SUNAT');

    fixture = TestBed.createComponent(CajeroTicketModalComponent);
    fixture.componentRef.setInput('ticket', ticket({ comprobante: comprobante() }));
    fixture.componentRef.setInput('envioSunat', {
      ordenId: 77,
      comprobanteId: 9,
      tipo: 'BOLETA',
      serieNumero: 'B001-123',
      nombreArchivo: '20608945123-03-B001-123',
      estado: 'ACEPTADO',
      codigoRespuesta: '0',
      descripcion: 'La Boleta numero B001-123, ha sido aceptada',
      observaciones: null,
      hash: 'abc==',
      total: 50,
      intentos: 1,
      enviadoEn: '2026-11-23T20:00:00',
      tieneCdr: true
    });
    fixture.detectChanges();
    const textoAceptado = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textoAceptado).toContain('ACEPTADO');
    expect(textoAceptado).toContain('Ticket SUNAT (QR)');
    expect(textoAceptado).toContain('XML');
    expect(textoAceptado).toContain('CDR');
    expect(textoAceptado).not.toContain('ELECTRÓNICA');
  });

  it('muestra ANULADO y oculta envío SUNAT cuando el comprobante está anulado, y permite reintentar en ERROR o ENVIANDO', () => {
    const anuladoTexto = render(ticket({ comprobante: comprobante({ anulado: true }) }));
    expect(anuladoTexto).toContain('ANULADO');
    expect(anuladoTexto).not.toContain('Enviar a SUNAT');

    fixture = TestBed.createComponent(CajeroTicketModalComponent);
    fixture.componentRef.setInput('ticket', ticket({ comprobante: comprobante() }));
    fixture.componentRef.setInput('envioSunat', {
      ordenId: 77,
      comprobanteId: 9,
      tipo: 'BOLETA',
      serieNumero: 'B001-123',
      nombreArchivo: '20608945123-03-B001-123',
      estado: 'OBSERVADO',
      codigoRespuesta: '0',
      descripcion: 'Aceptada con observaciones',
      observaciones: 'Obs 4001',
      hash: 'abc==',
      total: 50,
      intentos: 1,
      enviadoEn: '2026-11-23T20:00:00',
      tieneCdr: false
    });
    fixture.detectChanges();
    const obsTexto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(obsTexto).toContain('OBSERVADO');
    expect(obsTexto).toContain('Obs 4001');
    expect(obsTexto).not.toContain('CDR');

    fixture.componentRef.setInput('envioSunat', {
      ordenId: 77,
      comprobanteId: 9,
      tipo: 'BOLETA',
      serieNumero: 'B001-123',
      nombreArchivo: '20608945123-03-B001-123',
      estado: 'ENVIANDO',
      codigoRespuesta: null,
      descripcion: null,
      observaciones: null,
      hash: null,
      total: 50,
      intentos: 1,
      enviadoEn: '2026-11-23T20:00:00',
      tieneCdr: false
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reintentar envío SUNAT');
  });
});
