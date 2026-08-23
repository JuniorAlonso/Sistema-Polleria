import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Order, OrderStatus, CreateOrderRequest } from '../models/order.model';
import { of, delay, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private http = inject(HttpClient);

  // Initial seed orders for demonstration and immediate UI testing
  private readonly initialOrders: Order[] = [
    {
      id: 'ord-101',
      codigoSeguimiento: 'POL-7821',
      cliente: {
        nombre: 'Carlos Mendoza',
        celular: '987654321',
        correo: 'carlos.m@example.com',
        direccion: 'Av. Los Próceres 450, Dpto 302',
        referencia: 'Frente al parque'
      },
      items: [
        {
          product: {
            id: 'prod-1',
            nombre: '1 Pollo a la Brasa Tradicional',
            descripcion: '1 Pollo entero dorado a la leña con papas y ensalada.',
            precio: 74.90,
            imagenUrl: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=800&q=80',
            categoria: 'POLLOS_A_LA_BRASA',
            agotado: false
          },
          cantidad: 1,
          notas: 'Papas bien doradas y ají extra por favor',
          subtotal: 74.90
        },
        {
          product: {
            id: 'prod-8',
            nombre: 'Chicha Morada Artesanal (1 Litro)',
            descripcion: 'Elaborada con maíz morado.',
            precio: 14.00,
            imagenUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
            categoria: 'BEBIDAS',
            agotado: false
          },
          cantidad: 1,
          subtotal: 14.00
        }
      ],
      tipo: 'DELIVERY',
      estado: 'EN_PREPARACION',
      metodoPago: 'YAPE',
      subtotal: 88.90,
      costoEnvio: 6.00,
      descuento: 0.00,
      total: 94.90,
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
    },
    {
      id: 'ord-102',
      codigoSeguimiento: 'POL-7822',
      cliente: {
        nombre: 'María Ramos',
        celular: '912345678',
        mesaNumero: 4
      },
      items: [
        {
          product: {
            id: 'prod-2',
            nombre: '1/2 Pollo a la Brasa',
            descripcion: 'Medio pollo jugoso.',
            precio: 42.50,
            imagenUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
            categoria: 'POLLOS_A_LA_BRASA',
            agotado: false
          },
          cantidad: 2,
          subtotal: 85.00
        }
      ],
      tipo: 'SALON',
      estado: 'LISTO_COCINA',
      metodoPago: 'TARJETA',
      subtotal: 85.00,
      costoEnvio: 0.00,
      descuento: 0.00,
      total: 85.00,
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
    }
  ];

  // State Signals
  readonly orders = signal<Order[]>(this.initialOrders);
  readonly currentTrackingOrder = signal<Order | null>(null);
  readonly isLoading = signal<boolean>(false);

  // Computed Kitchen KDS orders (RF16: Kitchen screen)
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

  /**
   * RF13/RF15: Crear Pedido
   */
  createOrder(orderData: Order): Order {
    this.orders.update(prev => [orderData, ...prev]);
    this.currentTrackingOrder.set(orderData);
    return orderData;
  }

  /**
   * RF17: Consultar estado en tiempo real
   */
  getOrderByTrackingCode(code: string): Order | undefined {
    const found = this.orders().find(
      o => o.codigoSeguimiento.toUpperCase() === code.toUpperCase() || o.id === code
    );
    if (found) {
      this.currentTrackingOrder.set(found);
    }
    return found;
  }

  /**
   * RF15/RF16: Máquina de estados - Transiciones válidas
   */
  updateOrderStatus(orderId: string, newStatus: OrderStatus): void {
    this.orders.update(items =>
      items.map(order => {
        if (order.id === orderId) {
          const updated = {
            ...order,
            estado: newStatus,
            updatedAt: new Date().toISOString()
          };
          if (this.currentTrackingOrder()?.id === orderId) {
            this.currentTrackingOrder.set(updated);
          }
          return updated;
        }
        return order;
      })
    );
  }

  // Helper para avance de estado en cocina
  advanceKitchenStatus(orderId: string): void {
    const order = this.orders().find(o => o.id === orderId);
    if (!order) return;

    if (order.estado === 'PAGADO') {
      this.updateOrderStatus(orderId, 'EN_PREPARACION');
    } else if (order.estado === 'EN_PREPARACION') {
      this.updateOrderStatus(orderId, 'LISTO_COCINA');
    } else if (order.estado === 'LISTO_COCINA') {
      if (order.tipo === 'DELIVERY') {
        this.updateOrderStatus(orderId, 'EN_REPARTO');
      } else {
        this.updateOrderStatus(orderId, 'COMPLETADO');
      }
    } else if (order.estado === 'EN_REPARTO') {
      this.updateOrderStatus(orderId, 'COMPLETADO');
    }
  }
}
