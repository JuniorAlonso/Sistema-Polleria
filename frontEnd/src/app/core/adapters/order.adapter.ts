import {
  BackendCrearOrdenRequest,
  BackendOrdenEstado,
  BackendOrdenResponse,
  BackendOrdenTipo
} from '../models/api-contracts.model';
import { CreateOrderRequest, Order, OrderStatus, OrderType, PaymentMethod } from '../models/order.model';
import { CartItem } from '../models/product.model';

export class OrderAdapter {
  /**
   * Mapea estado del backend al estado visual del frontend
   */
  static toOrderStatus(backendEstado: BackendOrdenEstado | string): OrderStatus {
    if (!backendEstado) return 'PAGADO';
    const est = backendEstado.toUpperCase();

    switch (est) {
      case 'RECIBIDO':
        return 'PAGADO'; // En frontend 'PAGADO' o 'RECIBIDO' indica que ya está en cola de cocina
      case 'EN_PREPARACION':
        return 'EN_PREPARACION';
      case 'LISTO':
        return 'LISTO_COCINA';
      case 'EN_CAMINO':
        return 'EN_REPARTO';
      case 'ENTREGADO':
        return 'COMPLETADO';
      case 'CANCELADO':
        return 'CANCELADO';
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
      case 'PENDIENTE_PAGO':
      case 'PAGADO':
      case 'RECIBIDO':
        return 'RECIBIDO';
      case 'EN_PREPARACION':
        return 'EN_PREPARACION';
      case 'LISTO_COCINA':
      case 'LISTO':
        return 'LISTO';
      case 'EN_REPARTO':
      case 'EN_CAMINO':
        return 'EN_CAMINO';
      case 'COMPLETADO':
      case 'ENTREGADO':
        return 'ENTREGADO';
      case 'CANCELADO':
        return 'CANCELADO';
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

    return {
      id: String(dto.id),
      codigoSeguimiento: trackingCode,
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
      metodoPago: 'TARJETA', // Se complementa si se consulta pago
      subtotal: Math.round(subtotal * 100) / 100,
      costoEnvio: Math.round(costoEnvio * 100) / 100,
      descuento: 0,
      total: Math.round(total * 100) / 100,
      notasGenerales: dto.observaciones || undefined,
      createdAt: dto.creadoEn || new Date().toISOString(),
      updatedAt: dto.actualizadoEn || dto.creadoEn || new Date().toISOString(),
      repartidorAsignado: dto.repartidorId ? {
        nombre: `Repartidor #${dto.repartidorId}`,
        celular: '987 112 233'
      } : undefined
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
    const mesaId = tipo === 'SALON' ? (req.cliente.mesaNumero || 1) : undefined;

    const items = (req.items || []).map(it => {
      // Extraer ID numérico si viene como 'prod-1' o '1'
      const cleanId = String(it.productoId).replace('prod-', '');
      const numericId = parseInt(cleanId, 10) || 1;

      return {
        productoId: numericId,
        cantidad: it.cantidad || 1,
        notas: it.notas || undefined
      };
    });

    return {
      tipo: tipo,
      mesaId: mesaId,
      direccionEntrega: tipo === 'DELIVERY' ? (req.cliente.direccion || 'Dirección no especificada') : undefined,
      referencia: tipo === 'DELIVERY' ? req.cliente.referencia : undefined,
      nombreCliente: req.cliente.nombre || 'Cliente San Pollo',
      telefonoCliente: req.cliente.celular || '999999999',
      observaciones: req.notasGenerales || undefined,
      items: items
    };
  }
}
