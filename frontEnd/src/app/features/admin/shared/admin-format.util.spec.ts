import { Order } from '../../../core/models/order.model';
import { ghostHint, ghostWindow, proofRemainingMs } from './admin-format.util';

function orden(over: Partial<Order>): Order {
  return {
    id: '1', codigoSeguimiento: 'POL-1', cliente: { nombre: 'A', celular: '1' }, items: [],
    tipo: 'DELIVERY', estado: 'EN_PUERTA', subtotal: 1, costoEnvio: 0, descuento: 0, total: 1,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over
  };
}

describe('ghostWindow', () => {
  const now = Date.parse('2026-01-01T01:00:00Z');

  it('delivery: 30 minutes at the door', () => {
    const w = ghostWindow(orden({ enPuertaAt: '2026-01-01T00:40:00Z' }), now)!;
    expect(w.canDeclare).toBeFalse();
    expect(ghostHint(w)).toBe('Disponible en 10 min');
    expect(ghostWindow(orden({ enPuertaAt: '2026-01-01T00:30:00Z' }), now)!.canDeclare).toBeTrue();
  });

  it('pickup: 1 hour ready in store', () => {
    const pickup = orden({ tipo: 'RECOJO_EN_TIENDA', estado: 'LISTO_COCINA', listoAt: '2026-01-01T00:01:00Z' });
    expect(ghostWindow(pickup, now)!.canDeclare).toBeFalse();
    expect(ghostWindow({ ...pickup, listoAt: '2026-01-01T00:00:00Z' }, now)!.canDeclare).toBeTrue();
  });

  it('is not applicable to other states and cannot be declared without a timestamp', () => {
    expect(ghostWindow(orden({ estado: 'EN_REPARTO' }), now)).toBeNull();
    const sinHora = ghostWindow(orden({ enPuertaAt: undefined }), now)!;
    expect(sinHora.canDeclare).toBeFalse();
    expect(sinHora.remainingMs).toBeNull();
  });
});

describe('proofRemainingMs', () => {
  it('counts 15 minutes from order creation', () => {
    const now = Date.parse('2026-01-01T00:10:00Z');
    expect(proofRemainingMs(orden({}), now)).toBe(5 * 60_000);
    expect(proofRemainingMs(orden({}), now + 6 * 60_000)!).toBeLessThan(0);
  });
});
