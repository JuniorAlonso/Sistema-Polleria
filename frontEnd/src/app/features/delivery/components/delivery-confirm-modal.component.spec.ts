import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeliveryConfirmModalComponent } from './delivery-confirm-modal.component';
import { Order } from '../../../core/models/order.model';

describe('DeliveryConfirmModalComponent', () => {
  let component: DeliveryConfirmModalComponent;
  let fixture: ComponentFixture<DeliveryConfirmModalComponent>;

  const mockOrderContraEntrega: Order = {
    id: '101',
    codigoSeguimiento: 'POL-101',
    cliente: { nombre: 'Carlos Quispe', celular: '987654321', direccion: 'Calle Real 123' },
    items: [],
    tipo: 'DELIVERY',
    estado: 'EN_REPARTO',
    requiereCobroEfectivo: true,
    total: 35.0,
    subtotal: 35.0,
    costoEnvio: 0,
    descuento: 0,
    montoPagaCon: 50.0,
    vueltoEstimado: 15.0,
    createdAt: '2026-11-09T10:00:00',
    updatedAt: '2026-11-09T10:00:00'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryConfirmModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveryConfirmModalComponent);
    component = fixture.componentInstance;
  });

  it('deshabilita el boton de confirmar si el monto recibido es menor al total y muestra alerta de faltante', () => {
    fixture.componentRef.setInput('order', mockOrderContraEntrega);
    fixture.componentRef.setInput('montoPagaCliente', 20.0);
    fixture.componentRef.setInput('vuelto', 0);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button[disabled]');
    expect(btn).toBeTruthy();

    const alerta = fixture.nativeElement.textContent;
    expect(alerta).toContain('Monto insuficiente: faltan');
    expect(alerta).toContain('15.00');
  });

  it('habilita el boton de confirmar cuando el monto recibido cubre el total', () => {
    fixture.componentRef.setInput('order', mockOrderContraEntrega);
    fixture.componentRef.setInput('montoPagaCliente', 50.0);
    fixture.componentRef.setInput('vuelto', 15.0);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button:not([disabled])');
    expect(component.esBotonDeshabilitado()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Vuelto a entregar:');
  });

  it('calcula los billetes sugeridos superiores al total del pedido', () => {
    fixture.componentRef.setInput('order', mockOrderContraEntrega); // total 35
    fixture.componentRef.setInput('montoPagaCliente', 35.0);
    fixture.componentRef.setInput('vuelto', 0);
    fixture.detectChanges();

    // 20 es menor que 35, por tanto sugeridos son 50, 100, 200
    expect(component.billetesSugeridos()).toEqual([50, 100, 200]);
  });
});

