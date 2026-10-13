import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { Order, OrderStatus, CreateOrderRequest } from '../models/order.model';
import { BackendActualizarEstadoRequest, BackendOrdenResponse } from '../models/api-contracts.model';
import { OrderAdapter } from '../adapters/order.adapter';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly API_URL = environment.ordersApiUrl || 'http://localhost:8082';

  // State Signals
  readonly orders = signal<Order[]>([]);
  readonly myOrders = signal<Order[]>([]);
  readonly currentTrackingOrder = signal<Order | null>(null);
  readonly isLoading = signal<boolean>(false);

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
      this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/mis-ordenes`).pipe(
        map(dtos => OrderAdapter.toOrderList(dtos)),
        tap(orders => this.myOrders.set([...orders].sort((a, b) => Number(b.id) - Number(a.id)))),
        catchError(() => of([]))
      ).subscribe();
      return;
    }

    const seguimiento = this.leerSeguimiento();
    if (seguimiento) {
      this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/seguimiento`, {
        headers: { 'X-Seguimiento-Token': seguimiento.token }
      }).pipe(
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
    return this.http.post<{ mensaje: string }>(`${this.API_URL}/ordenes/seguimiento/codigo`, { telefono }).pipe(
      map(res => res.mensaje),
      catchError(err => throwError(() => new Error(this.mensajeError(err, 'No se pudo enviar el código'))))
    );
  }

  /** Paso 2: valida el código y carga los pedidos de ese celular. */
  verificarCodigoSeguimiento(telefono: string, codigo: string): Observable<void> {
    return this.http.post<{ token: string }>(`${this.API_URL}/ordenes/seguimiento/verificar`, { telefono, codigo }).pipe(
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
          notasGenerales: orderRequest.notasGenerales
        };
      } else {
        createReq = orderRequest as CreateOrderRequest;
      }
    } else {
      createReq = orderRequest as CreateOrderRequest;
    }

    const backendReq = OrderAdapter.toBackendCrearRequest(createReq);

    return this.http.post<BackendOrdenResponse>(`${this.API_URL}/ordenes`, backendReq).pipe(
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
      return this.http.get<BackendOrdenResponse>(`${this.API_URL}/ordenes/${cleanId}`).pipe(
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
   * RF19: Cargar órdenes (activas e históricas)
   */
  loadActiveOrders(): void {
    this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes`).pipe(
      map(dtos => OrderAdapter.toOrderList(dtos)),
      tap(list => {
        if (list.length > 0) {
          const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
          const current = this.orders();
          const changed = current.length !== sorted.length || 
            sorted.some((o, i) => !current[i] || current[i].id !== o.id || current[i].estado !== o.estado || current[i].updatedAt !== o.updatedAt);
          if (changed) {
            this.orders.set(sorted);
          }
        }
      }),
      catchError(() => {
        return this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/activos`).pipe(
          map(dtos => OrderAdapter.toOrderList(dtos)),
          tap(list => {
            if (list.length > 0) {
              const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
              this.orders.set(sorted);
            }
          }),
          catchError(() => of([]))
        );
      })
    ).subscribe();
  }

  /**
   * RF19: Cargar órdenes para cocina
   */
  loadKitchenOrders(): void {
    this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/cocina`).pipe(
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
   * RF19: Actualización de Estado de Orden
   */
  updateOrderStatus(orderId: string, newStatus: OrderStatus, repartidorId?: number): Observable<Order> {
    const cleanId = this.extractNumericId(orderId);
    const backendEstado = OrderAdapter.toBackendEstado(newStatus);
    const estadoAnterior = this.orders();
    const trackingAnterior = this.currentTrackingOrder();

    // Optimistic UI update
    this.orders.update(items =>
      items.map(order => {
        if (order.id === orderId || (cleanId > 0 && order.id === String(cleanId))) {
          const updated: Order = {
            ...order,
            estado: newStatus,
            repartidorId: repartidorId !== undefined ? repartidorId : order.repartidorId,
            updatedAt: new Date().toISOString()
          };
          if (this.currentTrackingOrder()?.id === order.id) {
            this.currentTrackingOrder.set(updated);
          }
          return updated;
        }
        return order;
      })
    );

    if (cleanId > 0) {
      const payload: BackendActualizarEstadoRequest = {
        estado: backendEstado,
        repartidorId: repartidorId
      };

      return this.http.patch<BackendOrdenResponse>(`${this.API_URL}/ordenes/${cleanId}/estado`, payload).pipe(
        map(dto => OrderAdapter.toOrder(dto)),
        tap(updated => {
          this.orders.update(items =>
            items.map(o => o.id === updated.id ? updated : o)
          );
          if (this.currentTrackingOrder()?.id === updated.id) {
            this.currentTrackingOrder.set(updated);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // El backend rechazó la transición: la UI vuelve al estado real en lugar
          // de dejar el cambio optimista aplicado y emitir un resultado nulo.
          this.orders.set(estadoAnterior);
          this.currentTrackingOrder.set(trackingAnterior);
          return throwError(() => error);
        })
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
   * Helper para avance secuencial de estado exclusivo en cocina (PAGADO -> EN_PREPARACION -> LISTO_COCINA)
   */
  advanceKitchenStatus(orderId: string): void {
    const order = this.orders().find(o => o.id === orderId || this.extractNumericId(o.id) === this.extractNumericId(orderId));
    if (!order) return;

    // updateOrderStatus ya revierte el cambio optimista y propaga el error; aquí
    // solo se consume para no dejarlo sin manejar.
    const ignorarFallo = () => undefined;

    if (order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO') {
      this.updateOrderStatus(order.id, 'EN_PREPARACION').subscribe({ next: () => undefined, error: ignorarFallo });
    } else if (order.estado === 'EN_PREPARACION') {
      this.updateOrderStatus(order.id, 'LISTO_COCINA').subscribe({ next: () => undefined, error: ignorarFallo });
    }
  }

  private extractNumericId(id: string): number {
    if (!id) return 0;
    const clean = id.replace('POL-', '').replace('ord-', '');
    return parseInt(clean, 10) || 0;
  }
}
