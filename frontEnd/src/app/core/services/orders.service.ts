import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap, forkJoin } from 'rxjs';
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

  constructor() {
    this.loadActiveOrders();
    this.loadMyOrders();
  }

  private getStorageKey(): string {
    if (!isPlatformBrowser(this.platformId)) return 'polleria_my_orders';
    try {
      const userStr = localStorage.getItem('polleria_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && (u.email || u.id)) {
          return `polleria_my_orders_${u.email || u.id}`;
        }
      }
    } catch {}
    return 'polleria_my_orders_guest';
  }

  /**
   * Registra una orden en el historial local del cliente
   */
  registerClientOrder(order: Order): void {
    this.myOrders.update(prev => [order, ...prev.filter(o => o.id !== order.id)]);
    this.currentTrackingOrder.set(order);

    if (isPlatformBrowser(this.platformId)) {
      try {
        const key = this.getStorageKey();
        const stored = localStorage.getItem(key);
        const ids: string[] = stored ? JSON.parse(stored) : [];
        if (!ids.includes(order.id)) {
          ids.unshift(order.id);
          localStorage.setItem(key, JSON.stringify(ids.slice(0, 20)));
        }
      } catch {
        // Ignorar error de storage
      }
    }
  }

  /**
   * Carga exclusivamente las órdenes del cliente actual
   */
  loadMyOrders(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const hasToken = !!localStorage.getItem('polleria_token');
    const storageKey = this.getStorageKey();
    let localIds: string[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) localIds = JSON.parse(stored);
    } catch {}

    if (hasToken) {
      // 1. Intentar cargar desde el endpoint del backend /ordenes/mis-ordenes
      this.http.get<BackendOrdenResponse[]>(`${this.API_URL}/ordenes/mis-ordenes`).pipe(
        map(dtos => OrderAdapter.toOrderList(dtos)),
        tap(backendOrders => {
          if (localIds.length > 0) {
            this.mergeMyOrders(backendOrders, localIds);
          } else {
            const sorted = [...backendOrders].sort((a, b) => Number(b.id) - Number(a.id));
            this.myOrders.set(sorted);
          }
        }),
        catchError(() => {
          this.loadLocalStoredOrders(localIds);
          return of([]);
        })
      ).subscribe();
    } else {
      // 2. Si no está autenticado, cargar solo las órdenes de invitado
      this.loadLocalStoredOrders(localIds);
    }
  }

  private mergeMyOrders(backendOrders: Order[], localIds: string[]): void {
    const existingIds = new Set(backendOrders.map(o => o.id));
    const pendingIds = localIds.filter(id => !existingIds.has(id));

    if (pendingIds.length === 0) {
      const sorted = [...backendOrders].sort((a, b) => Number(b.id) - Number(a.id));
      this.myOrders.set(sorted);
      return;
    }

    const requests = pendingIds.map(id => 
      this.http.get<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}`).pipe(
        map(dto => OrderAdapter.toOrder(dto)),
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe(localOrders => {
      const validLocal = localOrders.filter((o): o is Order => !!o);
      const combined = [...backendOrders, ...validLocal];
      const sorted = combined.sort((a, b) => Number(b.id) - Number(a.id));
      this.myOrders.set(sorted);
    });
  }

  private loadLocalStoredOrders(localIds: string[]): void {
    if (localIds.length === 0) {
      this.myOrders.set([]);
      return;
    }

    const requests = localIds.map(id => 
      this.http.get<BackendOrdenResponse>(`${this.API_URL}/ordenes/${id}`).pipe(
        map(dto => OrderAdapter.toOrder(dto)),
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe(orders => {
      const valid = orders.filter((o): o is Order => !!o);
      const sorted = valid.sort((a, b) => Number(b.id) - Number(a.id));
      this.myOrders.set(sorted);
    });
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
      catchError(() => {
        this.isLoading.set(false);
        // Fallback local si el microservicio devuelve error
        const fallbackOrder: Order = {
          id: String(Date.now()),
          codigoSeguimiento: `POL-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente: createReq.cliente,
          items: (createReq.items || []).map(it => ({
            product: {
              id: String(it.productoId),
              nombre: 'Producto',
              descripcion: '',
              precio: 0,
              imagenUrl: '/assets/images/hero-panoramic.jpg',
              categoria: 'POLLOS_A_LA_BRASA',
              agotado: false
            },
            cantidad: it.cantidad,
            notas: it.notas,
            subtotal: 0
          })),
          tipo: createReq.tipo,
          estado: 'EN_PREPARACION',
          metodoPago: createReq.metodoPago,
          subtotal: 0,
          costoEnvio: createReq.tipo === 'DELIVERY' ? 6 : 0,
          descuento: 0,
          total: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.orders.update(prev => [fallbackOrder, ...prev]);
        this.registerClientOrder(fallbackOrder);
        return of(fallbackOrder);
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
  updateOrderStatus(orderId: string, newStatus: OrderStatus, repartidorId?: number): Observable<Order | null> {
    const cleanId = this.extractNumericId(orderId);
    const backendEstado = OrderAdapter.toBackendEstado(newStatus);

    // Optimistic UI update
    this.orders.update(items =>
      items.map(order => {
        if (order.id === orderId || (cleanId > 0 && order.id === String(cleanId))) {
          const updated = {
            ...order,
            estado: newStatus,
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
        catchError(() => of(null))
      );
    }

    return of(null);
  }

  /**
   * Helper para avance secuencial de estado exclusivo en cocina (PAGADO -> EN_PREPARACION -> LISTO_COCINA)
   */
  advanceKitchenStatus(orderId: string): void {
    const order = this.orders().find(o => o.id === orderId || this.extractNumericId(o.id) === this.extractNumericId(orderId));
    if (!order) return;

    if (order.estado === 'PAGADO' || order.estado === 'PENDIENTE_PAGO') {
      this.updateOrderStatus(order.id, 'EN_PREPARACION').subscribe();
    } else if (order.estado === 'EN_PREPARACION') {
      this.updateOrderStatus(order.id, 'LISTO_COCINA').subscribe();
    }
  }

  private extractNumericId(id: string): number {
    if (!id) return 0;
    const clean = id.replace('POL-', '').replace('ord-', '');
    return parseInt(clean, 10) || 0;
  }
}
