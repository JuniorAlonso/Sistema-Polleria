import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { KitchenKdsComponent } from './kitchen-kds.component';
import { OrdersService } from '../../core/services/orders.service';
import { ProductsService } from '../../core/services/products.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Order, OrderItem, OrderStatus } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';

function tokenDeSesion(): string {
  const b64 = btoa(JSON.stringify({ userId: 9 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${b64}.firma-falsa`;
}

const producto = (id: string, nombre: string): Product => ({
  id,
  nombre,
  descripcion: '',
  precio: 65,
  imagenUrl: '',
  categoria: 'POLLOS_A_LA_BRASA',
  agotado: false
});

function ordenDe(tipo: Order['tipo'], estado: OrderStatus, over: Partial<Order> = {}): Order {
  return {
    id: tipo === 'SALON' ? '7' : '8',
    codigoSeguimiento: tipo === 'SALON' ? 'POL-7' : 'POL-8',
    cliente: {
      nombre: tipo === 'SALON' ? 'Mesa 03' : 'María García',
      celular: '999888777',
      mesaNumero: tipo === 'SALON' ? 3 : undefined,
      direccion: tipo === 'DELIVERY' ? 'Av. Siempre Viva 742' : undefined
    },
    items: [{ id: 101, ronda: 1, product: producto('1', 'Pollo a la Brasa Entero'), cantidad: 1, subtotal: 65 }],
    tipo,
    estado,
    metodoPago: 'TARJETA',
    subtotal: 65,
    costoEnvio: 0,
    descuento: 0,
    total: 65,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over
  };
}

/**
 * S4.9 — cocina distingue el pedido de salón: muestra la mesa y usa el texto de servir
 * en mesa en lugar del de reparto/motorizado. El delivery conserva su texto.
 */
describe('KitchenKdsComponent — comanda de salón', () => {
  let fixture: ComponentFixture<KitchenKdsComponent>;
  let component: KitchenKdsComponent;
  let http: HttpTestingController;
  let orders: OrdersService;
  let notify: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      imports: [KitchenKdsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    TestBed.inject(AuthService).token.set(tokenDeSesion());
    fixture = TestBed.createComponent(KitchenKdsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    orders = TestBed.inject(OrdersService);
    notify = TestBed.inject(NotificationService);
    spyOn(notify, 'showSuccess');
    spyOn(notify, 'showError');
    spyOn(notify, 'showWarning');

    fixture.detectChanges();
    http.match(r => r.method === 'GET').forEach(r => r.flush([]));
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  it('muestra la mesa del pedido de salón y el texto de servir en mesa', () => {
    orders.orders.set([ordenDe('SALON', 'LISTO_COCINA')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Mesa 3');
    expect(texto).toContain('el mozo ya puede servirla en mesa');
    expect(texto).not.toContain('motorizado');
  });

  it('el botón de listo de salón no habla de reparto; el de delivery conserva su texto', () => {
    orders.orders.set([
      ordenDe('SALON', 'EN_PREPARACION'),
      ordenDe('DELIVERY', 'EN_PREPARACION')
    ]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Listo para servir en mesa');
    expect(texto).toContain('Listo para Reparto / Empacado');
  });

  it('el delivery LISTO sigue mostrando el aviso del motorizado', () => {
    orders.orders.set([ordenDe('DELIVERY', 'LISTO_COCINA')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Esperando que el motorizado retire el pedido');
    expect(texto).not.toContain('servirla en mesa');
  });

  it('el recojo en tienda muestra "Listo para recoger" en botón y aviso sin mencionar motorizado ni reparto', () => {
    orders.orders.set([
      ordenDe('RECOJO_EN_TIENDA', 'EN_PREPARACION', { id: '20', codigoSeguimiento: 'POL-20' }),
      ordenDe('RECOJO_EN_TIENDA', 'LISTO_COCINA', { id: '21', codigoSeguimiento: 'POL-21' })
    ]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Listo para recoger');
    expect(texto).toContain('Esperando que el cliente retire el pedido en tienda');
    expect(texto).not.toContain('motorizado');
    expect(texto).not.toContain('Listos para Reparto');
  });

  it('ordena las comandas por antigüedad: la más vieja primero (S3.4)', () => {
    orders.orders.set([
      ordenDe('DELIVERY', 'EN_PREPARACION', { createdAt: '2026-01-01T00:10:00Z' }),
      ordenDe('SALON', 'EN_PREPARACION', { createdAt: '2026-01-01T00:00:00Z' })
    ]);
    fixture.detectChanges();

    expect(component.rawKitchenOrders().map(o => o.id))
      .withContext('cocina atiende por orden de llegada')
      .toEqual(['7', '8']);
  });

  it('calcula los minutos de espera y tolera una fecha inválida (S3.4)', () => {
    const haceDiez = new Date(Date.now() - 10 * 60_000).toISOString();

    expect(component.minutosEspera(ordenDe('SALON', 'PAGADO', { createdAt: haceDiez })))
      .toBeGreaterThanOrEqual(9);
    expect(component.minutosEspera(ordenDe('SALON', 'PAGADO', { createdAt: 'no-es-fecha' })))
      .toBe(0);
  });

  it('marca la comanda recién recibida y muestra el tiempo transcurrido (S3.4)', () => {
    orders.orders.set([ordenDe('SALON', 'PAGADO')]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Nueva');
    expect(texto).toContain('hace');
    expect(texto).toContain('min');
  });

  it('muestra el aviso cuando falla la carga de órdenes (P1)', () => {
    orders.hasError.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string)
      .toContain('Sin conexión con el servicio de pedidos');
  });

  it('1. muestra de forma independiente dos ítems del mismo producto con diferentes item.id y sus notas', () => {
    const mismoProducto = producto('1', '1/4 de Pollo a la Brasa');
    const items: OrderItem[] = [
      { id: 501, ronda: 1, product: mismoProducto, cantidad: 1, notas: 'Parte pecho, sin ensalada', subtotal: 22 },
      { id: 502, ronda: 1, product: mismoProducto, cantidad: 2, notas: 'Parte pierna, bien cocido', subtotal: 44 }
    ];
    orders.orders.set([ordenDe('SALON', 'PAGADO', { items, subtotal: 66, total: 66 })]);
    fixture.detectChanges();

    const filasItems = fixture.nativeElement.querySelectorAll('[data-testid="kds-order-item"]') as NodeListOf<HTMLElement>;
    expect(filasItems.length).toBe(2);
    expect(filasItems[0].getAttribute('data-item-id')).toBe('501');
    expect(filasItems[0].textContent).toContain('1x');
    expect(filasItems[0].textContent).toContain('Parte pecho, sin ensalada');

    expect(filasItems[1].getAttribute('data-item-id')).toBe('502');
    expect(filasItems[1].textContent).toContain('2x');
    expect(filasItems[1].textContent).toContain('Parte pierna, bien cocido');
  });

  it('2 y 3. agrupa los ítems de una misma ronda y separa visualmente rondas diferentes sin mezclarlas', () => {
    const prodPollo = producto('1', 'Pollo a la Brasa Entero');
    const prodChicha = producto('2', 'Jarra Chicha Morada');
    const items: OrderItem[] = [
      { id: 601, ronda: 1, product: prodPollo, cantidad: 1, notas: 'Con papas crocantes', subtotal: 65 },
      { id: 602, ronda: 1, product: prodChicha, cantidad: 1, notas: 'Helada', subtotal: 15 },
      { id: 603, ronda: 2, product: prodPollo, cantidad: 1, notas: 'Extra ají', subtotal: 65 }
    ];
    orders.orders.set([ordenDe('SALON', 'EN_PREPARACION', { items, subtotal: 145, total: 145 })]);
    fixture.detectChanges();

    const gruposRonda = fixture.nativeElement.querySelectorAll('[data-testid="kds-ronda-group"]') as NodeListOf<HTMLElement>;
    expect(gruposRonda.length).toBe(2);
    expect(gruposRonda[0].getAttribute('data-ronda')).toBe('1');
    expect(gruposRonda[1].getAttribute('data-ronda')).toBe('2');

    const badgesRonda = fixture.nativeElement.querySelectorAll('[data-testid="kds-ronda-badge"]') as NodeListOf<HTMLElement>;
    expect(badgesRonda.length).toBe(2);
    expect(badgesRonda[0].textContent?.trim()).toBe('RONDA 1');
    expect(badgesRonda[1].textContent?.trim()).toBe('RONDA 2');

    const itemsRonda1 = gruposRonda[0].querySelectorAll('[data-testid="kds-order-item"]');
    const itemsRonda2 = gruposRonda[1].querySelectorAll('[data-testid="kds-order-item"]');
    expect(itemsRonda1.length).toBe(2);
    expect(itemsRonda2.length).toBe(1);
    expect(itemsRonda1[0].getAttribute('data-item-id')).toBe('601');
    expect(itemsRonda1[1].getAttribute('data-item-id')).toBe('602');
    expect(itemsRonda2[0].getAttribute('data-item-id')).toBe('603');
  });

  it('4. interpreta ronda = null o undefined como RONDA 1', () => {
    const items: OrderItem[] = [
      { id: 701, ronda: null as unknown as number, product: producto('1', 'Pollo Entero'), cantidad: 1, subtotal: 65 },
      { id: 702, ronda: undefined, product: producto('2', 'Inca Kola 1.5L'), cantidad: 1, subtotal: 13 }
    ];
    orders.orders.set([ordenDe('SALON', 'PAGADO', { items })]);
    fixture.detectChanges();

    const gruposRonda = fixture.nativeElement.querySelectorAll('[data-testid="kds-ronda-group"]') as NodeListOf<HTMLElement>;
    expect(gruposRonda.length).toBe(1);
    expect(gruposRonda[0].getAttribute('data-ronda')).toBe('1');
    expect(gruposRonda[0].textContent).toContain('RONDA 1');
    expect(gruposRonda[0].querySelectorAll('[data-testid="kds-order-item"]').length).toBe(2);
  });

  it('5 y 6. muestra la etiqueta MOSTRADOR únicamente cuando tipo = RECOJO y canalOrigen = SALON, y conserva DELIVERY y SALON', () => {
    orders.orders.set([
      ordenDe('RECOJO_EN_TIENDA', 'PAGADO', { id: '10', codigoSeguimiento: 'POL-10', canalOrigen: 'SALON' }),
      ordenDe('RECOJO_EN_TIENDA', 'PAGADO', { id: '11', codigoSeguimiento: 'POL-11', canalOrigen: 'WEB', createdAt: '2026-01-01T00:01:00Z' }),
      ordenDe('DELIVERY', 'PAGADO', { id: '12', codigoSeguimiento: 'POL-12', canalOrigen: 'WHATSAPP', createdAt: '2026-01-01T00:02:00Z' }),
      ordenDe('SALON', 'PAGADO', { id: '13', codigoSeguimiento: 'POL-13', canalOrigen: 'SALON', createdAt: '2026-01-01T00:03:00Z' })
    ]);
    fixture.detectChanges();

    const badges = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="order-type-badge"]') as NodeListOf<HTMLElement>
    ).map(el => el.textContent?.trim());

    expect(badges).toEqual(['MOSTRADOR', 'RECOJO_EN_TIENDA', 'DELIVERY', 'SALON']);
  });

  it('7. no duplica ítems durante las actualizaciones del polling y evita solicitudes GET concurrentes si una sigue pendiente', fakeAsync(() => {
    const dtoRonda1 = {
      id: 7,
      tipo: 'SALON',
      estado: 'PREPARANDO',
      total: 65,
      mesaNumero: 3,
      nombreCliente: 'Mesa 03',
      telefonoCliente: '',
      creadoEn: '2026-01-01T00:00:00Z',
      items: [
        { id: 801, productoId: 1, productoNombre: 'Pollo a la Brasa Entero', cantidad: 1, precioUnitario: 65, subtotal: 65, ronda: 1 }
      ]
    };

    const dtoConRonda2 = {
      ...dtoRonda1,
      total: 130,
      items: [
        { id: 801, productoId: 1, productoNombre: 'Pollo a la Brasa Entero', cantidad: 1, precioUnitario: 65, subtotal: 65, ronda: 1 },
        { id: 802, productoId: 1, productoNombre: 'Pollo a la Brasa Entero', cantidad: 1, precioUnitario: 65, subtotal: 65, ronda: 2 }
      ]
    };

    // Primer ciclo de polling (2.5s)
    orders.loadActiveOrders();
    // Si otro ciclo dispara loadActiveOrders antes de que responda el primero, no debe abrir un segundo GET concurrente
    orders.loadActiveOrders();
    const getReqs1 = http.match(r => r.method === 'GET' && r.url.endsWith('/ordenes'));
    expect(getReqs1.length).toBe(1);
    getReqs1[0].flush([dtoRonda1]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="kds-order-item"]').length).toBe(1);

    // Segundo ciclo de polling con el mismo estado/timestamp pero nueva ronda agregada
    orders.loadActiveOrders();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes')).flush([dtoConRonda2]);
    fixture.detectChanges();

    const itemsDom = fixture.nativeElement.querySelectorAll('[data-testid="kds-order-item"]') as NodeListOf<HTMLElement>;
    expect(itemsDom.length).toBe(2);
    expect(itemsDom[0].getAttribute('data-item-id')).toBe('801');
    expect(itemsDom[1].getAttribute('data-item-id')).toBe('802');

    // Tercer ciclo de polling idéntico: no duplica ítems
    orders.loadActiveOrders();
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/ordenes')).flush([dtoConRonda2]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="kds-order-item"]').length).toBe(2);
    tick(2500);
    http.match(r => r.method === 'GET').forEach(r => r.flush([dtoConRonda2]));
  }));

  it('8. bloquea acciones incompatibles con las reglas del Plan 1 (cierre/cancelación de SALON, doble clic y errores HTTP)', () => {
    const ordenSalon = ordenDe('SALON', 'LISTO_COCINA');
    orders.orders.set([ordenSalon]);
    fixture.detectChanges();

    // Cocina nunca puede pasar una comanda SALON a COMPLETADO, ENTREGADO ni CANCELADO
    for (const estadoProhibido of ['COMPLETADO', 'ENTREGADO', 'CANCELADO'] as OrderStatus[]) {
      component.cambiarEstadoOrden(ordenSalon, estadoProhibido);
      http.expectNone(r => r.method === 'PATCH');
    }
    expect(notify.showWarning).toHaveBeenCalledTimes(3);

    // Prevención de doble clic al avanzar estado permitido (PAGADO -> EN_PREPARACION)
    const ordenRecibida = ordenDe('SALON', 'PAGADO');
    orders.orders.set([ordenRecibida]);
    fixture.detectChanges();

    component.cambiarEstadoOrden(ordenRecibida, 'EN_PREPARACION');
    component.cambiarEstadoOrden(ordenRecibida, 'EN_PREPARACION'); // segundo clic mientras sigue en vuelo

    const patchReqs = http.match(r => r.method === 'PATCH' && r.url.endsWith('/ordenes/7/estado'));
    expect(patchReqs.length).toBe(1);

    // Respuesta de error HTTP 409 comunicada de forma comprensible
    patchReqs[0].flush(
      { error: 'Transición de estado inválida en cocina' },
      { status: 409, statusText: 'Conflict' }
    );
    expect(notify.showError).toHaveBeenCalledWith('Transición de estado inválida en cocina');
    expect(component.estaProcesandoOrden('7')).toBeFalse();
  });

  describe('Gestión de Disponibilidad en Cocina (PROMPT 10)', () => {
    let productsService: ProductsService;

    beforeEach(() => {
      productsService = TestBed.inject(ProductsService);
    });

    it('1. carga inicial y refresco de productos al cambiar a la pestaña DISPONIBILIDAD', () => {
      spyOn(productsService, 'loadProducts');

      component.onTabChange('DISPONIBILIDAD');
      fixture.detectChanges();

      expect(component.activeTab()).toBe('DISPONIBILIDAD');
      expect(productsService.loadProducts).toHaveBeenCalled();
      expect(component.getActiveTabLabel()).toBe('Disponibilidad de Platos & Carta');
    });

    it('2. visualiza productos con nombre, precio, categoría y estados claros de disponible y agotado', () => {
      component.activeTab.set('DISPONIBILIDAD');
      const prodDisp = producto('1', 'Pollo Entero a la Brasa');
      prodDisp.agotado = false;
      const prodAgot = producto('2', 'Chicha Morada 1L');
      prodAgot.agotado = true;
      prodAgot.categoria = 'BEBIDAS';

      (productsService as any)._products.set([prodDisp, prodAgot]);
      fixture.detectChanges();

      const tarjetas = fixture.nativeElement.querySelectorAll('[data-testid="tarjeta-producto-cocina"]') as NodeListOf<HTMLElement>;
      expect(tarjetas.length).toBe(2);

      // Primer producto disponible
      expect(tarjetas[0].textContent).toContain('Pollo Entero a la Brasa');
      expect(tarjetas[0].querySelector('[data-testid="badge-estado-disponible"]')?.textContent).toContain('DISPONIBLE');
      expect(tarjetas[0].querySelector('[data-testid="btn-toggle-disponibilidad"]')?.textContent).toContain('Marcar como AGOTADO');

      // Segundo producto agotado
      expect(tarjetas[1].textContent).toContain('Chicha Morada 1L');
      expect(tarjetas[1].querySelector('[data-testid="badge-estado-agotado"]')?.textContent).toContain('AGOTADO');
      expect(tarjetas[1].querySelector('[data-testid="btn-toggle-disponibilidad"]')?.textContent).toContain('Marcar como DISPONIBLE');

      // Badges en sidebar y header
      expect(component.agotadosCount()).toBe(1);
      const sidebarBadge = fixture.nativeElement.querySelector('[data-testid="sidebar-agotados-badge"]');
      expect(sidebarBadge?.textContent).toContain('1 agotados');
      const headerBadge = fixture.nativeElement.querySelector('[data-testid="header-agotados-badge"]');
      expect(headerBadge?.textContent).toContain('Agotados: 1');
    });

    it('3. alterna exitosamente la disponibilidad y actualiza el estado compartido de ProductsService', () => {
      component.activeTab.set('DISPONIBILIDAD');
      const prod = producto('10', '1/4 Pollo Pecho');
      prod.agotado = false;
      (productsService as any)._products.set([prod]);
      fixture.detectChanges();

      // Cocina hace clic para marcarlo como agotado
      component.alternarDisponibilidadProducto(prod);

      // Verificación de actualización optimista en el signal compartido
      expect(productsService.products().find(p => p.id === '10')?.agotado).toBeTrue();

      // Petición HTTP PATCH al backend
      const patchReq = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/productos/10/disponibilidad'));
      patchReq.flush({
        id: 10,
        nombre: '1/4 Pollo Pecho',
        categoria: 'POLLO_ENTERO',
        precio: 22,
        disponible: false
      });
      fixture.detectChanges();

      expect(notify.showSuccess).toHaveBeenCalledWith('"1/4 Pollo Pecho" marcado como agotado.');
      expect(component.estaProcesandoProducto('10')).toBeFalse();
    });

    it('4. maneja errores del backend sin ocultarlos y revierte el estado optimista', () => {
      component.activeTab.set('DISPONIBILIDAD');
      const prod = producto('10', 'Pollo Sin Stock');
      prod.agotado = true; // actualmente agotado
      (productsService as any)._products.set([prod]);
      fixture.detectChanges();

      // Intentar marcar como disponible cuando el backend no lo permite por falta de stock
      component.alternarDisponibilidadProducto(prod);

      const patchReq = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/productos/10/disponibilidad'));
      patchReq.flush(
        { error: "'Pollo Sin Stock' no tiene stock: repón unidades antes de activarlo." },
        { status: 400, statusText: 'Bad Request' }
      );
      fixture.detectChanges();

      // No se oculta el mensaje de error del backend
      expect(notify.showError).toHaveBeenCalledWith("'Pollo Sin Stock' no tiene stock: repón unidades antes de activarlo.");
      // La carta revierte al estado real (sigue agotado)
      expect(productsService.products().find(p => p.id === '10')?.agotado).toBeTrue();
      expect(component.estaProcesandoProducto('10')).toBeFalse();
    });

    it('5. previene solicitudes duplicadas ante clics repetidos sobre el mismo producto', () => {
      component.activeTab.set('DISPONIBILIDAD');
      const prod = producto('15', 'Anticuchos');
      prod.agotado = false;
      (productsService as any)._products.set([prod]);
      fixture.detectChanges();

      // Primer clic inicia la petición
      component.alternarDisponibilidadProducto(prod);
      expect(component.estaProcesandoProducto('15')).toBeTrue();

      // Clics subsiguientes mientras la petición está en vuelo no disparan nuevas llamadas
      component.alternarDisponibilidadProducto(prod);
      component.alternarDisponibilidadProducto(prod);

      const patchReqs = http.match(r => r.method === 'PATCH' && r.url.endsWith('/productos/15/disponibilidad'));
      expect(patchReqs.length).toBe(1);

      patchReqs[0].flush({
        id: 15,
        nombre: 'Anticuchos',
        categoria: 'PIQUEOS_Y_BEBIDAS',
        precio: 25,
        disponible: false
      });
      fixture.detectChanges();

      expect(component.estaProcesandoProducto('15')).toBeFalse();
    });

    it('6. confirma que el tablero de comandas KDS sigue funcionando al alternar pestañas', () => {
      orders.orders.set([ordenDe('SALON', 'EN_PREPARACION')]);
      fixture.detectChanges();

      // Cambiar a Disponibilidad (dispara GET /productos?soloDisponibles=false)
      component.onTabChange('DISPONIBILIDAD');
      http.expectOne(r => r.method === 'GET' && r.url.includes('/productos')).flush([]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-kitchen-disponibilidad')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-kitchen-order-card')).toBeFalsy();

      // Volver a Comandas KDS
      component.onTabChange('KDS');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-kitchen-disponibilidad')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('app-kitchen-order-card')).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('Mesa 3');
    });
  });
});
