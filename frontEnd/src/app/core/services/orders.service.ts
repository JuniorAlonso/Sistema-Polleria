import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { Order, OrderStatus, CreateOrderRequest } from '../models/order.model';
import { BackendActualizarEstadoRequest, BackendOrdenResponse } from '../models/api-contracts.model';
import { OrdersApiService } from '../api/orders-api.service';
import { OrderAdapter } from '../adapters/order.adapter';

/** Initial states a checkout may request; the backend rejects any other (S2). */
const ESTADOS_INICIALES_CHECKOUT: OrderStatus[] = ['PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO'];

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private api = inject(OrdersApiService);
  private platformId = inject(PLATFORM_ID);

  // State Signals
  readonly orders = signal<Order[]>([]);
  readonly myOrders = signal<Order[]>([]);
  readonly currentTrackingOrder = signal<Order | null>(null);
  readonly isLoading = signal<boolean>(false);
  /** true cuando fallan /ordenes y el fallback /ordenes/activos: la UI debe avisar, no fingir vacío. */
  readonly hasError = signal<boolean>(false);
  /** S10 — pedidos que el backend ofrece al repartidor: DELIVERY LISTO sin repartidor, del más viejo al más nuevo. */
  readonly pedidosDisponibles = signal<Order[]>([]);

  // Computed Kitchen KDS orders (RF16 / KDS)
  readonly kitchenOrders = computed(() =>
    this.orders().filter(o =>
      ['PAGADO', 'EN_PREPARACION', 'LISTO_COCINA'].includes(o.estado)
    )
  );

  // Active delivery orders
  readonly activeDeliveryOrders = computed(() =>
    this.orders().filter(o =>
      o.tipo === 'DELIVERY' && !['COMPLETADO', 'CANCELADO'].includes(o.estado)
    )
  );

  // Seguimiento sin cuenta: acceso temporal obtenido al verificar el celular por WhatsApp
  private static readonly SEGUIMIENTO_KEY = 'polleria_seguimiento';
  readonly seguimientoTelefono = signal<string | null>(null);

  constructor() {
    // Las listas generales (/ordenes) son solo para el personal: sus pantallas las cargan
    this.seguimientoTelefono.set(this.leerSeguimiento()?.telefono ?? null);
    this.loadMyOrders();
  }

  /**
   * Registra en memoria una orden recién creada para mostrarla de inmediato en el seguimiento
   */
  registerClientOrder(order: Order): void {
    this.myOrders.update(prev => [order, ...prev.filter(o => o.id !== order.id)]);
    this.currentTrackingOrder.set(order);
  }

  /**
   * Pedidos del cliente:
   * - con sesión iniciada: los de su cuenta;
   * - sin sesión pero con el celular verificado: los de ese celular;
   * - si no, se conserva lo que haya en memoria (p. ej. el pedido recién creado).
   */
  loadMyOrders(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (localStorage.getItem('polleria_token')) {
      this.api.listarMisOrdenes().pipe(
        map(dtos => OrderAdapter.toOrderList(dtos)),
        tap(orders => this.myOrders.set([...orders].sort((a, b) => Number(b.id) - Number(a.id)))),
        catchError(() => of([]))
      ).subscribe();
      return;
    }

    const seguimiento = this.leerSeguimiento();
    if (seguimiento) {
      this.api.listarSeguimiento(seguimiento.token).pipe(
        map(dtos => OrderAdapter.toOrderList(dtos)),
        tap(orders => this.myOrders.set(orders)),
        catchError(err => {
          // Acceso vencido: hay que volver a verificar el celular
          if (err?.status === 400) this.cerrarSeguimiento();
          return of([]);
        })
      ).subscribe();
    }
  }

  /** Paso 1: pide un código de 4 dígitos que llega por WhatsApp. */
  solicitarCodigoSeguimiento(telefono: string): Observable<string> {
    return this.api.solicitarCodigoSeguimiento(telefono).pipe(
      map(res => res.mensaje),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo enviar el código'))))
    );
  }

  /** Paso 2: valida el código y carga los pedidos de ese celular. */
  verificarCodigoSeguimiento(telefono: string, codigo: string): Observable<void> {
    return this.api.verificarCodigoSeguimiento(telefono, codigo).pipe(
      tap(res => {
        try {
          sessionStorage.setItem(OrdersService.SEGUIMIENTO_KEY, JSON.stringify({ token: res.token, telefono }));
        } catch {}
        this.seguimientoTelefono.set(telefono);
        this.loadMyOrders();
      }),
      map(() => undefined),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo verificar el código'))))
    );
  }

  cerrarSeguimiento(): void {
    try {
      sessionStorage.removeItem(OrdersService.SEGUIMIENTO_KEY);
    } catch {}
    this.seguimientoTelefono.set(null);
    this.myOrders.set([]);
  }

  /**
   * S5: el invitado cancela su propio pedido con el mismo acceso de seguimiento (celular
   * verificado por WhatsApp) que usa `loadMyOrders`. El backend reutiliza el flujo de cancelación
   * del personal y solo acepta la petición si el celular del token coincide con el del pedido.
   */
  cancelarPedidoInvitado(orderId: string | number): Observable<Order> {
    const cleanId = this.extractNumericId(String(orderId));
    if (cleanId <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${orderId}`));
    }

    const seguimiento = this.leerSeguimiento();
    if (!seguimiento) {
      return throwError(() => new Error('Verifica tu celular para cancelar el pedido'));
    }

    return this.api.cancelarSeguimiento(cleanId, seguimiento.token).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.myOrders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
        if (this.currentTrackingOrder()?.id === updated.id) {
          this.currentTrackingOrder.set(updated);
        }
      }),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo cancelar el pedido'))))
    );
  }

  private leerSeguimiento(): { token: string; telefono: string } | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const guardado = sessionStorage.getItem(OrdersService.SEGUIMIENTO_KEY);
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  }

  private mensajeError(err: any, porDefecto: string): string {
    if (err?.status === 0) return 'No se pudo conectar con el servicio de pedidos';
    return err?.error?.error || err?.error?.mensaje || porDefecto;
  }

  /**
   * RF15/RF16: Crear Pedido en orders-service (:8082)
   */
  createOrder(orderRequest: CreateOrderRequest | Order): Observable<Order> {
    this.isLoading.set(true);

    let createReq: CreateOrderRequest;
    if ('cliente' in orderRequest && 'items' in orderRequest) {
      if ('codigoSeguimiento' in orderRequest) {
        // Viene como Order
        createReq = {
          tipo: orderRequest.tipo,
          cliente: orderRequest.cliente,
          items: orderRequest.items.map(it => ({
            productoId: it.product.id,
            cantidad: it.cantidad,
            notas: it.notas
          })),
          metodoPago: orderRequest.metodoPago,
          notasGenerales: orderRequest.notasGenerales,
          // ContraPago / capture orders must open waiting for the cashier; dropping the state
          // created them as RECIBIDO (straight to the kitchen) and skipped the sanction check.
          estadoInicial: ESTADOS_INICIALES_CHECKOUT.includes(orderRequest.estado) ? orderRequest.estado : undefined,
          montoPagaCon: orderRequest.montoPagaCon
        };
      } else {
        createReq = orderRequest as CreateOrderRequest;
      }
    } else {
      createReq = orderRequest as CreateOrderRequest;
    }

    const backendReq = OrderAdapter.toBackendCrearRequest(createReq);

    return this.api.crear(backendReq).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(createdOrder => {
        this.isLoading.set(false);
        this.orders.update(prev => [createdOrder, ...prev.filter(o => o.id !== createdOrder.id)]);
        this.registerClientOrder(createdOrder);
      }),
      catchError(err => {
        this.isLoading.set(false);
        // No se inventa un pedido local: si el backend falla, el cliente debe saberlo y reintentar
        const erroresCampo = err?.error?.errors ? Object.values(err.error.errors).join('. ') : null;
        const errMsg = erroresCampo || err?.error?.error || err?.error?.message
          || (err?.status === 0 ? 'No se pudo conectar con el servicio de pedidos (:8082)' : 'No se pudo registrar el pedido');
        return throwError(() => new Error(typeof errMsg === 'string' ? errMsg : 'No se pudo registrar el pedido'));
      })
    );
  }

  /**
   * RF17: Consultar estado en tiempo real
   */
  getOrderByTrackingCode(code: string): Observable<Order | undefined> {
    const cleanId = this.extractNumericId(code);

    if (cleanId > 0) {
      return this.api.obtener(cleanId).pipe(
        map(dto => OrderAdapter.toOrder(dto)),
        tap(found => {
          if (found) {
            this.currentTrackingOrder.set(found);
            this.orders.update(prev => [found, ...prev.filter(o => o.id !== found.id)]);
          }
        }),
        catchError(() => {
          const local = this.orders().find(
            o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code
          );
          if (local) this.currentTrackingOrder.set(local);
          return of(local);
        })
      );
    }

    const local = this.orders().find(
      o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code
    );
    if (local) this.currentTrackingOrder.set(local);
    return of(local);
  }

  /**
   * S6.5: lectura puntual de una orden (modal de mesa del mozo).
   * Sin efectos secundarios: no toca orders(), myOrders() ni currentTrackingOrder().
   * El id debe ser un entero positivo (acepta el prefijo POL-/ord-); si no, no se
   * dispara ningún GET a /ordenes/NaN.
   */
  obtenerOrden(id: string | number): Observable<Order> {
    const raw = String(id ?? '').trim().replace(/^POL-/i, '').replace(/^ord-/i, '');
    const idNumerico = Number(raw);

    if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${id}`));
    }

    return this.api.obtener(idNumerico).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo cargar la orden'))))
    );
  }

  /**
   * S3.3 / S4.5: segunda ronda sobre la comanda de salón.
   * Reutiliza la MISMA orden (`POST /ordenes/{id}/items`), nunca abre otra comanda para la mesa.
   * El backend recalcula el total y, si la comanda estaba LISTO, la devuelve a EN_PREPARACION.
   */
  agregarItemsAOrden(
    ordenId: string | number,
    items: { productoId: string | number; cantidad: number; notas?: string }[]
  ): Observable<Order> {
    const cleanId = this.extractNumericId(String(ordenId));
    if (cleanId <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }
    if (!items || items.length === 0) {
      return throwError(() => new Error('La comanda debe tener al menos un producto'));
    }

    const body = {
      items: items.map(it => ({
        productoId: Number(String(it.productoId).replace('prod-', '')),
        cantidad: it.cantidad || 1,
        notas: it.notas || undefined
      }))
    };

    return this.api.agregarItems(cleanId, body).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
        if (this.currentTrackingOrder()?.id === updated.id) {
          this.currentTrackingOrder.set(updated);
        }
      }),
      catchError(err => {
        const msg = err?.error?.error || err?.error?.message
          || (err?.status === 0 ? 'No se pudo conectar con el servicio de pedidos (:8082)' : null)
          || 'No se pudieron agregar los platos a la comanda';
        return throwError(() => new Error(typeof msg === 'string' ? msg : 'No se pudieron agregar los platos a la comanda'));
      })
    );
  }

  /**
   * S3.1 / S3.3: el mozo confirma que ya entregó la comanda en mesa.
   * No cambia el estado ni libera la mesa (eso ocurre al cobrar): solo persiste la marca.
   * El backend es idempotente y exige ADMIN/MOZO.
   */
  marcarServido(ordenId: string | number): Observable<Order> {
    const cleanId = this.extractNumericId(String(ordenId));
    if (cleanId <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${ordenId}`));
    }

    return this.api.servir(cleanId).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
        if (this.currentTrackingOrder()?.id === updated.id) {
          this.currentTrackingOrder.set(updated);
        }
      }),
      catchError(err => {
        const msg = err?.error?.error || err?.error?.message
          || (err?.status === 0 ? 'No se pudo conectar con el servicio de pedidos (:8082)' : null)
          || 'No se pudo marcar la comanda como servida';
        return throwError(() => new Error(
          typeof msg === 'string' ? msg : 'No se pudo marcar la comanda como servida'));
      })
    );
  }

  /**
   * RF19: Cargar órdenes (activas e históricas)
   */
  loadActiveOrders(): void {
    this.api.listar().pipe(
      map(dtos => OrderAdapter.toOrderList(dtos)),
      tap(list => {
        this.hasError.set(false);
        // An empty answer is the truth too: cancelled/removed orders must leave the list.
        const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
        const current = this.orders();
        const changed = current.length !== sorted.length ||
          sorted.some((o, i) => !current[i] || current[i].id !== o.id || current[i].estado !== o.estado || current[i].updatedAt !== o.updatedAt);
        if (changed) {
          this.orders.set(sorted);
        }
      }),
      catchError(() => {
        return this.api.listarActivas().pipe(
          map(dtos => OrderAdapter.toOrderList(dtos)),
          tap(list => {
            this.hasError.set(false);
            if (list.length > 0) {
              const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
              this.orders.set(sorted);
            }
          }),
          catchError(() => {
            // Ambos endpoints fallaron: la UI tiene que mostrarlo en vez de parecer vacía.
            this.hasError.set(true);
            return of([]);
          })
        );
      })
    ).subscribe();
  }

  /**
   * RF19: Cargar órdenes para cocina
   */
  loadKitchenOrders(): void {
    this.api.listarCocina().pipe(
      map(dtos => OrderAdapter.toOrderList(dtos)),
      tap(list => {
        if (list.length > 0) {
          this.orders.update(prev => {
            const existingIds = new Set(list.map(l => l.id));
            const others = prev.filter(p => !existingIds.has(p.id));
            return [...list, ...others];
          });
        }
      }),
      catchError(() => of([]))
    ).subscribe();
  }

  /**
   * S10 — lista de pedidos disponibles para tomar (delivery LISTO y sin repartidor). La verdad la
   * da el backend (`GET /ordenes/disponibles`, ordenado por antigüedad): no se filtra ni se
   * completa localmente. El llamador decide qué hacer con el resultado; el error se propaga con
   * el mensaje del backend.
   */
  listarDisponiblesParaEntrega(): Observable<Order[]> {
    return this.api.listarDisponibles().pipe(
      map(dtos => OrderAdapter.toOrderList(dtos)),
      tap(list => this.pedidosDisponibles.set(list)),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudieron cargar los pedidos disponibles'))))
    );
  }

  /**
   * S10 — el repartidor toma un pedido. El reclamo es atómico en el backend: asigna el repartidor
   * del token y, si otro llegó primero (o el pedido dejó de estar LISTO), responde 409 con su
   * mensaje, que se propaga tal cual. No cambia el estado del pedido.
   *
   * La lista compartida se actualiza recién con lo que responde el backend: nada de optimismo local.
   */
  reclamarPedido(orderId: string | number): Observable<Order> {
    const cleanId = this.extractNumericId(String(orderId));
    if (cleanId <= 0) {
      return throwError(() => new Error(`Id de orden inválido: ${orderId}`));
    }

    return this.api.reclamar(cleanId).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        // Lo que confirmó el backend es la verdad: el pedido aparece asignado y deja de ofrecerse.
        const existia = this.orders().some(o => o.id === updated.id);
        this.orders.update(prev => existia
          ? prev.map(o => o.id === updated.id ? updated : o)
          : [updated, ...prev]);
        this.pedidosDisponibles.update(prev => prev.filter(o => o.id !== updated.id));
      }),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo tomar el pedido'))))
    );
  }

  /**
   * RF19: Actualización de Estado de Orden
   */
  updateOrderStatus(orderId: string, newStatus: OrderStatus, repartidorId?: number, codigoTicket?: string): Observable<Order> {
    const cleanId = this.extractNumericId(orderId);
    const backendEstado = OrderAdapter.toBackendEstado(newStatus);

    // No optimistic update: the UI only changes with the state the backend returns (HTTP 200).
    if (cleanId > 0) {
      const payload: BackendActualizarEstadoRequest = {
        estado: backendEstado,
        repartidorId: repartidorId,
        // Only pickup hand-overs carry the ticket; other transitions keep the previous body.
        ...(codigoTicket ? { codigoTicket } : {})
      };

      return this.api.actualizarEstado(cleanId, payload).pipe(
        map(dto => OrderAdapter.toOrder(dto)),
        tap(updated => {
          this.orders.update(items =>
            items.map(o => o.id === updated.id ? updated : o)
          );
          if (this.currentTrackingOrder()?.id === updated.id) {
            this.currentTrackingOrder.set(updated);
          }
        }),
        catchError((error: HttpErrorResponse) => throwError(() => error))
      );
    }

    return throwError(() => new Error(`No se pudo determinar el id de la orden: ${orderId}`));
  }

  /**
   * RF18: Despacha una orden de delivery hacia 'EN_REPARTO' con motorizado asignado.
   * Si la orden se encuentra en 'EN_PREPARACION', realiza primero la transición obligatoria
   * hacia 'LISTO_COCINA' antes de enviarla a 'EN_REPARTO' con el repartidorId para cumplir
   * con la máquina de estados del backend.
   */
  dispatchDeliveryOrder(order: Order, repartidorId: number): Observable<Order> {
    if (order.estado === 'EN_PREPARACION') {
      return this.updateOrderStatus(order.id, 'LISTO_COCINA').pipe(
        switchMap(() => this.updateOrderStatus(order.id, 'EN_REPARTO', repartidorId))
      );
    }
    return this.updateOrderStatus(order.id, 'EN_REPARTO', repartidorId);
  }

  /**
   * Cierra/cobra una comanda de salón, realizando el avance secuencial
   * necesario si la orden no había sido completada en cocina aún.
   */
  completarOrdenSalon(orderId: string, currentStatus?: OrderStatus): Observable<Order> {
    const cleanId = this.extractNumericId(orderId);
    const order = this.orders().find(o => o.id === orderId || (cleanId > 0 && this.extractNumericId(o.id) === cleanId));
    const estado = currentStatus || order?.estado;

    // PENDIENTE_PAGO is not advanced from here: the backend only releases it after the payment is verified.
    if (estado === 'PAGADO') {
      return this.updateOrderStatus(orderId, 'EN_PREPARACION').pipe(
        switchMap(() => this.updateOrderStatus(orderId, 'LISTO_COCINA')),
        switchMap(() => this.updateOrderStatus(orderId, 'COMPLETADO'))
      );
    }
    if (estado === 'EN_PREPARACION') {
      return this.updateOrderStatus(orderId, 'LISTO_COCINA').pipe(
        switchMap(() => this.updateOrderStatus(orderId, 'COMPLETADO'))
      );
    }
    return this.updateOrderStatus(orderId, 'COMPLETADO');
  }

  /**
   * Helper para avance secuencial de estado exclusivo en cocina (PAGADO -> EN_PREPARACION -> LISTO_COCINA)
   */
  advanceKitchenStatus(orderId: string): void {
    const order = this.orders().find(o => o.id === orderId || this.extractNumericId(o.id) === this.extractNumericId(orderId));
    if (!order) return;

    // updateOrderStatus ya revierte el cambio optimista y propaga el error; aquí
    // solo se consume para no dejarlo sin manejar.
    const ignorarFallo = () => undefined;

    if (order.estado === 'PAGADO') {
      this.updateOrderStatus(order.id, 'EN_PREPARACION').subscribe({ next: () => undefined, error: ignorarFallo });
    } else if (order.estado === 'EN_PREPARACION') {
      this.updateOrderStatus(order.id, 'LISTO_COCINA').subscribe({ next: () => undefined, error: ignorarFallo });
    }
  }

  /**
   * Cajero confirma llamada telefónica para pedido ContraPago.
   */
  confirmarLlamada(orderId: string | number): Observable<Order> {
    const cleanId = typeof orderId === 'number' ? orderId : this.extractNumericId(orderId);
    return this.api.confirmarLlamada(cleanId).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
      })
    );
  }

  /**
   * Registra intento fallido de llamada para ContraPago.
   */
  registrarIntentoLlamada(orderId: string | number, observaciones?: string): Observable<Order> {
    const cleanId = typeof orderId === 'number' ? orderId : this.extractNumericId(orderId);
    return this.api.registrarIntentoLlamada(cleanId, observaciones).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
      })
    );
  }

  /**
   * Repartidor notifica que está en la puerta del domicilio del cliente.
   */
  marcarEnPuerta(orderId: string | number): Observable<Order> {
    const cleanId = typeof orderId === 'number' ? orderId : this.extractNumericId(orderId);
    return this.api.marcarEnPuerta(cleanId).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
      })
    );
  }

  /**
   * Declara pedido como fantasma (por timeout de 30m en puerta o 1h de recojo).
   */
  declararPedidoFantasma(orderId: string | number, motivo?: string): Observable<Order> {
    const cleanId = typeof orderId === 'number' ? orderId : this.extractNumericId(orderId);
    return this.api.declararPedidoFantasma(cleanId, motivo).pipe(
      map(dto => OrderAdapter.toOrder(dto)),
      tap(updated => {
        this.orders.update(prev => prev.map(o => o.id === updated.id ? updated : o));
      })
    );
  }

  private extractNumericId(id: string): number {
    if (!id) return 0;
    const clean = id.replace('POL-', '').replace('ord-', '');
    return parseInt(clean, 10) || 0;
  }
}
