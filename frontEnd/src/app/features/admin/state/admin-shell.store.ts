import { Injectable, computed, inject, signal } from '@angular/core';
import { OrdersService } from '../../../core/services/orders.service';
import { ProductsService } from '../../../core/services/products.service';
import { SalonService } from '../../../core/services/salon.service';
import { RepartidoresService } from '../../../core/services/repartidores.service';
import { PaymentService } from '../../../core/services/payment.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Order, OrderType, PaymentMethod } from '../../../core/models/order.model';
import { MesaSalon } from '../../../core/models/table.model';
import { InventarioSubTab, ManualOrderForm } from '../models/admin-forms';
import { getCodeNum } from '../shared/admin-format.util';

/**
 * Estado compartido entre las rutas hijas del panel admin: lo que más de una pestaña (o el shell)
 * necesita y por eso no vive en un contenedor de pestaña concreto:
 * - despacho con motorizado (lo abren Órdenes y Reparto),
 * - alta manual / segunda ronda de comanda (la abren Órdenes y Mesas),
 * - pago aprobado por orden y comprobantes pendientes (Órdenes, Notificaciones y el sidebar).
 */
@Injectable({ providedIn: 'root' })
export class AdminShellStore {
  private readonly ordersService = inject(OrdersService);
  private readonly productsService = inject(ProductsService);
  private readonly salonService = inject(SalonService);
  private readonly repartidoresService = inject(RepartidoresService);
  private readonly paymentService = inject(PaymentService);
  private readonly notify = inject(NotificationService);

  readonly getCodeNum = getCodeNum;

  /** Sub-pestaña de Inventario (el botón "Ver Carta" del header la fija antes de navegar). */
  readonly inventarioSubTab = signal<InventarioSubTab>('CARTA');

  // ── Pagos ───────────────────────────────────────────────────────────────────────────
  estaOrdenPagada(order: Order): boolean {
    if (!order) return false;
    const pago = this.paymentService.pagosPorOrdenMap().get(String(order.id));
    return pago?.estado === 'APROBADO' || order.estado === 'PAGADO';
  }

  /** Ids de las órdenes ya pagadas: permite a los componentes presentacionales mostrar el estado sin servicios. */
  readonly idsOrdenesPagadas = computed(() =>
    new Set(this.ordersService.orders().filter(o => this.estaOrdenPagada(o)).map(o => String(o.id)))
  );

  readonly comprobantesWhatsappPendientes = computed(() => {
    const orders = this.ordersService.orders();
    const pagosMap = this.paymentService.pagosPorOrdenMap();

    return orders.filter(o => {
      // 1. Verificación directa: el pago en payments-service está en PENDIENTE_VERIFICACION
      const pago = pagosMap.get(String(o.id));
      if (pago?.estado === 'PENDIENTE_VERIFICACION') {
        return true;
      }

      // 2. Órdenes con canal WHATSAPP o con pago YAPE que están en estado pendiente
      const esWhatsapp = o.canalOrigen === 'WHATSAPP';
      const esPagoYape = pago?.metodo === 'YAPE' || o.metodoPago === 'YAPE';
      const enEstadoPendiente = ['PENDIENTE_PAGO', 'RECIBIDO'].includes(o.estado);

      return (esWhatsapp || esPagoYape) && enEstadoPendiente && pago?.estado !== 'APROBADO' && o.estado !== 'CANCELADO' && o.estado !== 'COMPLETADO';
    });
  });

  // ── Motorizados ─────────────────────────────────────────────────────────────────────
  /** Nombre real del motorizado por id (roster de auth-service). */
  readonly nombresMotorizado = this.repartidoresService.nombrePorId;

  /**
   * Nombre real del motorizado, resuelto contra el roster de auth-service.
   * Sin ese roster se muestra el id: nunca un nombre inventado.
   */
  nombreMotorizado(order: Order): string {
    const id = order.repartidorId;
    if (id == null) return 'Por asignar';
    return this.repartidoresService.nombrePorId()[id] ?? `Motorizado #${id}`;
  }

  // Modal de Asignación de Motorizado (RF18)
  readonly orderToAssignDelivery = signal<Order | null>(null);
  /** Id del motorizado elegido en el modal. Sale del roster real de auth-service, no de una lista local. */
  selectedRepartidorId: number | null = null;
  readonly isDispatchingDelivery = signal<boolean>(false);

  /** Sin un motorizado elegido no hay a quién despachar el pedido. */
  puedeConfirmarDespacho(): boolean {
    const id = Number(this.selectedRepartidorId);
    return Number.isInteger(id) && id > 0;
  }

  abrirModalAsignarMotorizado(order: Order): void {
    this.orderToAssignDelivery.set(order);
    // El roster exige rol ADMIN y no se consulta desde el constructor: se pide al abrir el modal.
    this.repartidoresService.cargar();
    this.selectedRepartidorId = order.repartidorId ?? null;
  }

  cerrarModalAsignarMotorizado(): void {
    this.orderToAssignDelivery.set(null);
    this.isDispatchingDelivery.set(false);
  }

  confirmarAsignacionYDespacho(): void {
    const order = this.orderToAssignDelivery();
    if (!order) return;

    if (!this.puedeConfirmarDespacho()) {
      this.notify.showWarning('Selecciona un motorizado de la lista para despachar el pedido');
      return;
    }

    const repId = Number(this.selectedRepartidorId);
    this.isDispatchingDelivery.set(true);

    this.ordersService.dispatchDeliveryOrder(order, repId).subscribe({
      next: () => {
        const nombre = this.repartidoresService.nombrePorId()[repId] ?? `Motorizado #${repId}`;
        this.notify.showSuccess(`Orden #${this.getCodeNum(order.codigoSeguimiento)} asignada a ${nombre} y en camino`);
        this.cerrarModalAsignarMotorizado();
      },
      error: (err) => {
        // El backend rechaza la transición (p. ej. EN_PREPARACION -> EN_CAMINO): se muestra su motivo.
        this.isDispatchingDelivery.set(false);
        this.notify.showError(
          err?.error?.error || `No se pudo despachar la orden #${this.getCodeNum(order.codigoSeguimiento)}`
        );
      }
    });
  }

  // ── Alta manual / segunda ronda de comanda ──────────────────────────────────────────
  // Modal de Creación de Orden Manual
  showCreateOrderModal = false;
  manualOrder: ManualOrderForm = {
    // CREAR abre una comanda nueva; AGREGAR suma platos a la comanda activa de la mesa.
    modo: 'CREAR' as 'CREAR' | 'AGREGAR',
    ordenId: null as string | null,
    mesaId: null as string | number | null,
    tipo: 'DELIVERY' as OrderType,
    metodoPago: 'EFECTIVO_CONTRAENTREGA' as PaymentMethod,
    clienteNombre: '',
    clienteCelular: '',
    direccion: '',
    selectedProductId: '1',
    cantidad: 1,
    notas: ''
  };

  abrirModalNuevaOrden(): void {
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'CREAR',
      ordenId: null,
      mesaId: null,
      tipo: 'DELIVERY',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  /** Toma de comanda de salón desde el inspector de la mesa (sin comanda activa). */
  abrirTomarComandaMesa(mesa: MesaSalon): void {
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'CREAR',
      ordenId: null,
      mesaId: mesa.id,
      tipo: 'SALON',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  /** Segunda ronda: suma platos a la comanda activa de la mesa. */
  abrirAgregarPlatosMesa(mesa: MesaSalon): void {
    if (!mesa.ordenActiva) {
      this.abrirTomarComandaMesa(mesa);
      return;
    }
    const prods = this.productsService.products();
    this.manualOrder = {
      modo: 'AGREGAR',
      ordenId: String(mesa.ordenActiva.ordenId),
      mesaId: mesa.id,
      tipo: 'SALON',
      metodoPago: 'EFECTIVO_CONTRAENTREGA',
      clienteNombre: '',
      clienteCelular: '',
      direccion: '',
      selectedProductId: prods.length > 0 ? prods[0].id : '1',
      cantidad: 1,
      notas: ''
    };
    this.showCreateOrderModal = true;
  }

  recargarSalonYOrdenes(): void {
    this.salonService.cargarMesas();
    this.ordersService.loadActiveOrders();
  }

  crearOrdenManual(): void {
    const prod = this.productsService.products().find(p => p.id === this.manualOrder.selectedProductId);
    if (!prod) {
      this.notify.showError('Selecciona un producto válido');
      return;
    }

    const cantidad = Math.max(1, Number(this.manualOrder.cantidad) || 1);
    const items = [{ productoId: prod.id, cantidad, notas: this.manualOrder.notas }];

    if (this.manualOrder.modo === 'AGREGAR') {
      const ordenId = this.manualOrder.ordenId;
      if (!ordenId) {
        this.notify.showError('No se pudo determinar la comanda a ampliar');
        return;
      }
      this.ordersService.agregarItemsAOrden(ordenId, items).subscribe({
        next: () => {
          this.showCreateOrderModal = false;
          this.recargarSalonYOrdenes();
          this.notify.showSuccess(`${cantidad} plato(s) agregado(s) a la comanda #${this.getCodeNum(ordenId)}`);
        },
        error: (err) => this.notify.showError(
          'No se pudieron agregar los platos',
          err?.message || 'El servidor rechazó los platos nuevos'
        )
      });
      return;
    }

    const tipo = this.manualOrder.tipo;

    if (tipo === 'SALON') {
      const mesaId = Number(this.manualOrder.mesaId);
      const mesa = this.salonService.mesas().find(m => Number(m.id) === mesaId);
      if (!mesa) {
        this.notify.showError('Selecciona la mesa de la comanda');
        return;
      }
      if (mesa.ordenActiva) {
        this.notify.showWarning(
          'La mesa ya tiene una comanda activa',
          'Usá «Agregar platos» en el inspector de la mesa para sumar la segunda ronda.'
        );
        return;
      }

      this.ordersService.createOrder({
        tipo: 'SALON',
        mesaId,
        metodoPago: this.manualOrder.metodoPago,
        cliente: {
          nombre: `Mesa ${String(mesa.numero).padStart(2, '0')}`,
          celular: '',
          mesaNumero: mesa.numero
        },
        items
      }).subscribe({
        next: (created) => {
          this.showCreateOrderModal = false;
          this.recargarSalonYOrdenes();
          this.notify.showSuccess(`Comanda de ${mesa.nombre} creada (Orden #${this.getCodeNum(created.codigoSeguimiento)})`);
        },
        error: (err) => this.notify.showError(
          'Error al crear la comanda',
          err?.message || 'El servidor rechazó la comanda'
        )
      });
      return;
    }

    // DELIVERY / RECOJO: el cliente y su contacto son obligatorios.
    if (!this.manualOrder.clienteNombre || !this.manualOrder.clienteCelular) {
      this.notify.showError('Por favor ingresa nombre y celular del cliente');
      return;
    }

    if (tipo === 'DELIVERY' && !this.manualOrder.direccion.trim()) {
      this.notify.showError('Ingresa la dirección de entrega para un pedido de delivery');
      return;
    }

    this.ordersService.createOrder({
      tipo,
      metodoPago: this.manualOrder.metodoPago,
      cliente: {
        nombre: this.manualOrder.clienteNombre,
        celular: this.manualOrder.clienteCelular,
        // Sin dirección inventada: RECOJO no lleva dirección de entrega.
        direccion: tipo === 'DELIVERY' ? (this.manualOrder.direccion || undefined) : undefined
      },
      items
    }).subscribe({
      next: (created) => {
        this.showCreateOrderModal = false;
        this.ordersService.loadActiveOrders();
        this.notify.showSuccess(`Orden #${this.getCodeNum(created.codigoSeguimiento)} creada con éxito`);
      },
      error: (err) => this.notify.showError(
        'Error al crear orden en el backend',
        err?.message || 'El servidor rechazó el pedido'
      )
    });
  }
}
