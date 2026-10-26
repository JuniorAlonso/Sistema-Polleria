import {
  BackendCrearOrdenRequest,
  BackendOrdenEstado,
  BackendOrdenResponse,
  BackendOrdenTipo
} from '../models/api-contracts.model';
import { CreateOrderRequest, Order, OrderChannel, OrderStatus, OrderType, PaymentMethod } from '../models/order.model';
import { CartItem } from '../models/product.model';

/**
 * Contrato de T2 (S1): el backend ya expone `canalOrigen` en la respuesta y lo acepta en el alta,
 * pero `api-contracts.model.ts` todavía no declara el campo (no es parte del alcance de esta
 * tarea). Se tipa localmente para mapearlo sin inventar el dato ni romper el contrato compartido.
 */
type DtoOrdenConCanal = BackendOrdenResponse & { canalOrigen?: string };
type DtoCrearOrdenConCanal = BackendCrearOrdenRequest & { canalOrigen?: OrderChannel };

export class OrderAdapter {
  /**
   * Mapea estado del backend al estado visual del frontend
   */
  static toOrderStatus(backendEstado: BackendOrdenEstado | string): OrderStatus {
    if (!backendEstado) return 'PAGADO';
    const est = backendEstado.toUpperCase();

    switch (est) {
      case 'PENDIENTE_CONFIRMACION':
        return 'PENDIENTE_CONFIRMACION';
      case 'PENDIENTE_PAGO':
        return 'PENDIENTE_PAGO';
      case 'RECIBIDO':
        return 'PAGADO'; // En frontend 'PAGADO' o 'RECIBIDO' indica que ya está en cola de cocina
      case 'EN_PREPARACION':
      case 'PREPARANDO':
        return 'EN_PREPARACION';
      case 'LISTO':
      case 'LISTO_PARA_ENTREGAR':
        return 'LISTO_COCINA';
      case 'EN_CAMINO':
        return 'EN_REPARTO';
      case 'EN_PUERTA':
        return 'EN_PUERTA';
      case 'ENTREGADO':
        return 'COMPLETADO';
      case 'CANCELADO':
        return 'CANCELADO';
      case 'PEDIDO_FANTASMA':
        return 'PEDIDO_FANTASMA';
      default:
        return 'PAGADO';
    }
  }

  /**
   * Mapea estado del frontend al estado del backend
   */
  static toBackendEstado(status: OrderStatus | string): BackendOrdenEstado {
    if (!status) return 'RECIBIDO';
    const s = status.toUpperCase();

    switch (s) {
      case 'PENDIENTE_CONFIRMACION':
        return 'PENDIENTE_CONFIRMACION';
      case 'PENDIENTE_PAGO':
        return 'PENDIENTE_PAGO';
      case 'PAGADO':
      case 'RECIBIDO':
        return 'RECIBIDO';
      case 'EN_PREPARACION':
      case 'PREPARANDO':
        return 'PREPARANDO';
      case 'LISTO_COCINA':
      case 'LISTO':
        return 'LISTO';
      case 'LISTO_PARA_ENTREGAR':
        return 'LISTO_PARA_ENTREGAR';
      case 'EN_REPARTO':
      case 'EN_CAMINO':
        return 'EN_CAMINO';
      case 'EN_PUERTA':
        return 'EN_PUERTA';
      case 'COMPLETADO':
      case 'ENTREGADO':
        return 'ENTREGADO';
      case 'CANCELADO':
        return 'CANCELADO';
      case 'PEDIDO_FANTASMA':
        return 'PEDIDO_FANTASMA';
      default:
        return 'RECIBIDO';
    }
  }

  /**
   * Mapea tipo de orden del backend al frontend
   */
  static toOrderType(tipo: BackendOrdenTipo | string): OrderType {
    if (!tipo) return 'DELIVERY';
    const t = tipo.toUpperCase();
    if (t === 'SALON') return 'SALON';
    if (t === 'RECOJO' || t === 'RECOJO_EN_TIENDA') return 'RECOJO_EN_TIENDA';
    return 'DELIVERY';
  }

  /**
   * Mapea tipo de orden del frontend al backend
   */
  static toBackendTipo(tipo: OrderType | string): BackendOrdenTipo {
    if (!tipo) return 'DELIVERY';
    const t = tipo.toUpperCase();
    if (t === 'SALON') return 'SALON';
    if (t === 'RECOJO_EN_TIENDA' || t === 'RECOJO') return 'RECOJO';
    return 'DELIVERY';
  }

  /**
   * Transforma una orden del backend al modelo Order del frontend
   */
  static toOrder(dto: BackendOrdenResponse): Order {
    if (!dto) {
      throw new Error('Orden DTO nula o inválida');
    }

    const tipo = this.toOrderType(dto.tipo);
    const estado = this.toOrderStatus(dto.estado);
    const trackingCode = `POL-${dto.id}`;

    const items: CartItem[] = (dto.items || []).map(item => {
      const precioUnitario = typeof item.precioUnitario === 'number'
        ? item.precioUnitario
        : parseFloat(String(item.precioUnitario)) || 0;

      const subtotal = typeof item.subtotal === 'number'
        ? item.subtotal
        : parseFloat(String(item.subtotal)) || precioUnitario * (item.cantidad || 1);

      return {
        product: {
          id: String(item.productoId),
          nombre: item.productoNombre || 'Producto',
          descripcion: '',
          precio: precioUnitario,
          imagenUrl: '/assets/images/hero-panoramic.jpg',
          categoria: 'POLLOS_A_LA_BRASA',
          agotado: false
        },
        cantidad: item.cantidad || 1,
        notas: item.notas || undefined,
        subtotal: subtotal
      };
    });

    const total = typeof dto.total === 'number' ? dto.total : parseFloat(String(dto.total)) || 0;
    const subtotal = items.reduce((acc, it) => acc + it.subtotal, 0) || total;
    const costoEnvio = tipo === 'DELIVERY' ? Math.max(0, total - subtotal) : 0;

    // Canal de origen (S1): se propaga tal cual llega del backend. Las órdenes creadas antes de
    // esta columna no lo traen y quedan sin canal, no con un valor inventado.
    const canalOrigen = (dto as DtoOrdenConCanal).canalOrigen as OrderChannel | undefined;

    return {
      id: String(dto.id),
      codigoSeguimiento: trackingCode,
      numeroCliente: dto.numeroCliente ?? undefined,
      cliente: {
        nombre: dto.nombreCliente || 'Cliente',
        celular: dto.telefonoCliente || '',
        direccion: dto.direccionEntrega || undefined,
        referencia: dto.referencia || undefined,
        mesaNumero: dto.mesaNumero || undefined
      },
      items: items,
      tipo: tipo,
      estado: estado,
      canalOrigen: canalOrigen,
      subtotal: Math.round(subtotal * 100) / 100,
      costoEnvio: Math.round(costoEnvio * 100) / 100,
      descuento: 0,
      total: Math.round(total * 100) / 100,
      notasGenerales: dto.observaciones || undefined,
      createdAt: dto.creadoEn || new Date().toISOString(),
      updatedAt: dto.actualizadoEn || dto.creadoEn || new Date().toISOString(),
      // Solo el id: el nombre del motorizado vive en el roster de auth-service (solo ADMIN),
      // así que aquí no se fabrica un "Repartidor #7".
      repartidorId: dto.repartidorId,
      // Marca persistida de "ya se sirvió en mesa"; el estado sigue siendo LISTO hasta el cobro.
      servidoEn: dto.servidoEn || undefined,
      servidoPor: dto.servidoPor ?? undefined,
      enPuertaAt: dto.enPuertaAt || undefined,
      listoAt: dto.listoAt || undefined,
      intentosLlamada: dto.intentosLlamada ?? undefined,
      llamadaConfirmacionAt: dto.llamadaConfirmacionAt || undefined,
      requiereCobroEfectivo: dto.requiereCobroEfectivo === true,
      montoPagaCon: dto.montoPagaCon ?? undefined,
      vueltoEstimado: dto.vueltoEstimado ?? undefined,
      motivoFantasma: dto.motivoFantasma || undefined
    };
  }

  /**
   * Transforma lista de órdenes del backend de forma segura
   */
  static toOrderList(dtos: BackendOrdenResponse[]): Order[] {
    if (!Array.isArray(dtos)) return [];
    return dtos
      .filter(d => d && typeof d === 'object' && d.id !== undefined)
      .map(d => this.toOrder(d));
  }

  /**
   * Transforma el request de creación del frontend al DTO del backend
   */
  static toBackendCrearRequest(req: CreateOrderRequest): BackendCrearOrdenRequest {
    const tipo = this.toBackendTipo(req.tipo);
    // El id de la mesa viaja explícito. Antes se derivaba de `cliente.mesaNumero || 1`, que
    // confundía número visible con id y mandaba toda comanda sin mesa a la mesa 1. Si falta,
    // se deja ausente y el backend responde con su validación.
    const mesaId = tipo === 'SALON' ? req.mesaId : undefined;

    const items = (req.items || []).map(it => {
      // Extraer ID numérico si viene como 'prod-1' o '1'. Sin fallback: un id inválido no puede
      // convertirse silenciosamente en el producto 1 (se enviaría el plato equivocado).
      const cleanId = String(it.productoId).replace('prod-', '');
      const numericId = Number(cleanId);

      return {
        productoId: Number.isFinite(numericId) && numericId > 0 ? numericId : 0,
        cantidad: it.cantidad || 1,
        notas: it.notas || undefined
      };
    });

    return {
      tipo: tipo,
      canalOrigen: req.canalOrigen,
      estadoInicial: req.estadoInicial ? this.toBackendEstado(req.estadoInicial) : undefined,
      montoPagaCon: req.montoPagaCon,
      ipOrigen: req.ipOrigen,
      mesaId: mesaId,
      // Sin datos inventados: un pedido de delivery sin dirección real debe llegar
      // incompleto para que el backend lo rechace (RF14), y un teléfono falso haría
      // que las notificaciones de WhatsApp (RF30/RF31) apunten a un número inexistente.
      direccionEntrega: tipo === 'DELIVERY' ? (req.cliente.direccion || undefined) : undefined,
      referencia: tipo === 'DELIVERY' ? (req.cliente.referencia || undefined) : undefined,
      nombreCliente: req.cliente.nombre || undefined,
      telefonoCliente: req.cliente.celular || undefined,
      observaciones: req.notasGenerales || undefined,
      items: items
    } as DtoCrearOrdenConCanal;
  }
}
