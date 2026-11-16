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

  it('no convierte un producto inválido en el producto 1', () => {
    const req = OrderAdapter.toBackendCrearRequest({
      ...base,
      items: [{ productoId: 'no-es-un-id', cantidad: 1 }]
    });

    expect(req.items[0].productoId)
      .withContext('un id inválido debe llegar inválido, no como el plato 1')
      .toBe(0);
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

  it('propaga el estado de la mesa de la comanda (D3.14)', () => {
    expect(OrderAdapter.toOrder({ ...dto, mesaEstado: 'POR_COBRAR' } as never).mesaEstado).toBe('POR_COBRAR');
    expect(OrderAdapter.toOrder(dto as never).mesaEstado).toBeUndefined();
  });

  it('propaga la marca persistida de servido en mesa', () => {
    const orden = OrderAdapter.toOrder({
      ...dto,
      tipo: 'SALON',
      estado: 'LISTO',
      servidoEn: '2026-01-01T00:05:00Z',
      servidoPor: 7
    } as never);

    expect(orden.servidoEn).toBe('2026-01-01T00:05:00Z');
    expect(orden.servidoPor).toBe(7);
  });

  it('mapea un estado backend desconocido a DESCONOCIDO sin fabricar timestamps (FE-15)', () => {
    const orden = OrderAdapter.toOrder({
      ...dto,
      estado: 'ESTADO_FUTURO_RARO',
      creadoEn: undefined,
      actualizadoEn: undefined
    } as never);

    expect(orden.estado).toBe('DESCONOCIDO');
    expect(orden.createdAt).toBe('');
    expect(orden.updatedAt).toBe('');
  });
});

describe('OrderAdapter.toOrder — mapeo de id y ronda (Plan 1)', () => {
  const baseSalonDto = {
    id: 10,
    tipo: 'SALON' as const,
    estado: 'RECIBIDO' as const,
    mesaNumero: 4,
    total: 84.5,
    nombreCliente: 'Mesa 04',
    telefonoCliente: '',
    creadoEn: '2026-01-01T00:00:00Z'
  };

  it('mapea correctamente id y ronda de cada ítem persistido', () => {
    const orden = OrderAdapter.toOrder({
      ...baseSalonDto,
      items: [
        {
          id: 101,
          productoId: 1,
          productoNombre: 'Pollo a la Brasa Entero',
          cantidad: 1,
          precioUnitario: 65,
          subtotal: 65,
          ronda: 1
        },
        {
          id: 102,
          productoId: 3,
          productoNombre: 'Porción Tequeños Criollos',
          cantidad: 1,
          precioUnitario: 19.5,
          subtotal: 19.5,
          ronda: 2
        }
      ]
    });

    expect(orden.items.length).toBe(2);
    expect(orden.items[0].id).toBe(101);
    expect(orden.items[0].ronda).toBe(1);
    expect(orden.items[1].id).toBe(102);
    expect(orden.items[1].ronda).toBe(2);
  });

  it('interpreta ronda null o ausente como ronda 1 (registros históricos)', () => {
    const orden = OrderAdapter.toOrder({
      ...baseSalonDto,
      items: [
        {
          id: 201,
          productoId: 1,
          productoNombre: 'Pollo a la Brasa Entero',
          cantidad: 1,
          precioUnitario: 65,
          subtotal: 65,
          ronda: null
        },
        {
          id: 202,
          productoId: 2,
          productoNombre: 'Inka Kola 1.5L',
          cantidad: 1,
          precioUnitario: 12,
          subtotal: 12
        }
      ]
    });

    expect(orden.items[0].id).toBe(201);
    expect(orden.items[0].ronda).toBe(1);
    expect(orden.items[1].id).toBe(202);
    expect(orden.items[1].ronda).toBe(1);
  });
});
