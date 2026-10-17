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

  it('envía el mesaId explícito y no la dirección en un pedido de salón', () => {
    const req = OrderAdapter.toBackendCrearRequest({
      ...base,
      tipo: 'SALON',
      mesaId: 4,
      cliente: { nombre: 'Mesa 04', celular: '', mesaNumero: 4 }
    });

    expect(req.tipo).toBe('SALON');
    expect(req.mesaId).toBe(4);
    expect(req.direccionEntrega).toBeUndefined();
  });

  // S4.4: el número visible (`mesaNumero`) no es el id de la mesa. Sin mesaId explícito el
  // adaptador no inventa la mesa 1: lo deja ausente para que el backend responda con su validación.
  it('no inventa la mesa 1 cuando falta el mesaId de un pedido de salón', () => {
    const req = OrderAdapter.toBackendCrearRequest({
      ...base,
      tipo: 'SALON',
      cliente: { nombre: 'Mesa 04', celular: '', mesaNumero: 4 }
    });

    expect(req.mesaId).toBeUndefined();
  });
});

/**
 * RF18: el nombre del motorizado vive en el roster de auth-service, que exige rol ADMIN.
 * El adaptador solo puede propagar el id; fabricar un nombre ("Repartidor #7" o un caso
 * particular hardcodeado) pondría un dato falso en el panel y en el seguimiento del cliente.
 */
describe('OrderAdapter.toOrder — sin nombre de motorizado inventado', () => {
  const dto = {
    id: 5,
    tipo: 'DELIVERY',
    estado: 'EN_CAMINO',
    total: 68.5,
    nombreCliente: 'María',
    telefonoCliente: '999888777',
    items: [],
    creadoEn: '2026-01-01T00:00:00Z'
  };

  it('propaga el id del repartidor asignado', () => {
    const orden = OrderAdapter.toOrder({ ...dto, repartidorId: 7 } as never);

    expect(orden.repartidorId).toBe(7);
  });

  it('no fabrica un nombre de motorizado a partir del id', () => {
    const orden = OrderAdapter.toOrder({ ...dto, repartidorId: 7 } as never) as unknown as Record<string, unknown>;

    expect(orden['repartidorAsignado'])
      .withContext('el nombre solo lo puede resolver el roster real del admin')
      .toBeUndefined();
  });

  it('deja el pedido sin motorizado cuando el backend no manda id', () => {
    const orden = OrderAdapter.toOrder({ ...dto, repartidorId: null } as never);

    expect(orden.repartidorId == null).toBeTrue();
  });
});
