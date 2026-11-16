import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product } from '../models/product.model';

describe('CartService (FE-07: stock limits and catalog sync)', () => {
  let service: CartService;

  const makeProduct = (overrides: Partial<Product> = {}): Product => ({
    id: '10',
    nombre: '1/2 Pollo a la Brasa',
    descripcion: 'Con papas y ensalada',
    precio: 42,
    categoria: 'POLLOS_A_LA_BRASA',
    imagenUrl: 'pollo.jpg',
    agotado: false,
    stock: 3,
    ...overrides
  });

  beforeEach(() => {
    localStorage.removeItem('polleria_cart');
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
    service.clearCart();
  });

  afterEach(() => {
    localStorage.removeItem('polleria_cart');
  });

  it('respeta el límite de stock en addItem y updateQuantity', () => {
    const prod = makeProduct({ id: '1', stock: 3 });

    service.addItem(prod, 2);
    expect(service.items()[0].cantidad).toBe(2);

    service.addItem(prod, 5);
    expect(service.items()[0].cantidad).toBe(3);
    expect(service.items()[0].subtotal).toBe(126);

    service.updateQuantity('1', 2);
    expect(service.items()[0].cantidad).toBe(3);

    service.updateQuantity('1', -3);
    expect(service.isEmpty()).toBeTrue();
  });

  it('ignora productos agotados o con stock 0 al agregar', () => {
    service.addItem(makeProduct({ id: '2', agotado: true, stock: 10 }), 1);
    service.addItem(makeProduct({ id: '3', agotado: false, stock: 0 }), 1);

    expect(service.isEmpty()).toBeTrue();
  });

  it('sincronizarConProductos actualiza precios, ajusta stock y retira agotados', () => {
    const pPrecio = makeProduct({ id: '1', nombre: '1/4 Pollo', precio: 22, stock: 10 });
    const pStock = makeProduct({ id: '2', nombre: 'Chicha 1L', precio: 15, stock: 5 });
    const pAgotado = makeProduct({ id: '3', nombre: 'Tequeños', precio: 18, stock: 4 });

    service.addItem(pPrecio, 2);
    service.addItem(pStock, 4);
    service.addItem(pAgotado, 1);

    const sync = service.sincronizarConProductos([
      { ...pPrecio, precio: 25 },
      { ...pStock, stock: 2 },
      { ...pAgotado, agotado: true, stock: 0 }
    ]);

    expect(sync.huboCambios).toBeTrue();
    expect(sync.cambiosPrecio).toEqual(['1/4 Pollo: S/ 22.00 -> S/ 25.00']);
    expect(sync.cantidadesAjustadas).toEqual(['Chicha 1L: ajustado a 2']);
    expect(sync.agotadosEliminados).toEqual(['Tequeños']);

    expect(service.items().length).toBe(2);
    expect(service.items()[0].product.precio).toBe(25);
    expect(service.items()[0].subtotal).toBe(50);
    expect(service.items()[1].cantidad).toBe(2);
    expect(service.items()[1].subtotal).toBe(30);
  });

  it('no modifica el carrito si la carta vigente coincide exactamente', () => {
    const p = makeProduct({ id: '5', precio: 30, stock: 8 });
    service.addItem(p, 2);

    const sync = service.sincronizarConProductos([p]);

    expect(sync.huboCambios).toBeFalse();
    expect(service.items().length).toBe(1);
    expect(service.items()[0].subtotal).toBe(60);
  });
});
