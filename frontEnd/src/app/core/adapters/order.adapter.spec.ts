import { OrderAdapter } from '../adapters/order.adapter';
import { CreateOrderRequest } from '../models/order.model';

/**
 * Regla de negocio (S3.1 y RF14): el frontend no completa con valores inventados
 * los datos que envía al backend. Un pedido de delivery sin dirección ni teléfono
 * reales debe llegar incompleto para que el backend lo rechace, no con una
 * dirección y un celular plausibles pero falsos.
 */
describe('OrderAdapter.toBackendCrearRequest — sin datos inventados', () => {
  const base: CreateOrderRequest = {
    tipo: 'DELIVERY',
    metodoPago: 'EFECTIVO_CONTRAENTREGA',
    cliente: { nombre: '', celular: '' },
    items: [{ productoId: '1', cantidad: 1 }]
  };

  it('no inventa la dirección de entrega de un delivery', () => {
    const req = OrderAdapter.toBackendCrearRequest(base);
    expect(req.direccionEntrega)
      .withContext('sin dirección real el backend debe rechazar el pedido (RF14)')
      .toBeUndefined();
  });

  it('no inventa el teléfono del cliente', () => {
    const req = OrderAdapter.toBackendCrearRequest(base);
    expect(req.telefonoCliente)
      .withContext('un celular falso hace que WhatsApp notifique a un número inexistente')
      .toBeUndefined();
  });

  it('no inventa el nombre del cliente', () => {
    const req = OrderAdapter.toBackendCrearRequest(base);
    expect(req.nombreCliente).toBeUndefined();
  });

  it('mantiene los datos reales cuando el cliente los dio', () => {
    const req = OrderAdapter.toBackendCrearRequest({
      ...base,
      cliente: {
        nombre: 'María García',
        celular: '999888777',
        direccion: 'Av. Siempre Viva 742',
        referencia: 'Portón azul'
      }
    });

    expect(req.nombreCliente).toBe('María García');
    expect(req.telefonoCliente).toBe('999888777');
    expect(req.direccionEntrega).toBe('Av. Siempre Viva 742');
    expect(req.referencia).toBe('Portón azul');
  });

  it('no envía dirección ni referencia en un pedido de salón', () => {
    const req = OrderAdapter.toBackendCrearRequest({
      ...base,
      tipo: 'SALON',
      cliente: { nombre: 'Mesa 4', celular: '999888777', mesaNumero: 4 }
    });

    expect(req.tipo).toBe('SALON');
    expect(req.mesaId).toBe(4);
    expect(req.direccionEntrega).toBeUndefined();
  });
});
