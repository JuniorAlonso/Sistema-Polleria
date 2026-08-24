# 🍗 Sistema Pollería "El Buen Brasa" - Frontend (Angular 19 + Tailwind CSS)

Frontend moderno desarrollado con **Angular 19 (Standalone & Signals)**, **Tailwind CSS**, **SSR (Server-Side Rendering)** y estructurado para consumir la arquitectura de microservicios Spring Boot del Sistema de Pedidos y Delivery.

---

## 🧭 Guía Rápida para Desarrolladores de React (React -> Angular Cheatsheet)

Como vienes de React, aquí tienes la equivalencia exacta de cómo funciona este frontend:

| Concepto en React | Equivalente en este Proyecto (Angular 19) | Ejemplo en el Código |
| :--- | :--- | :--- |
| **`useState(0)`** | **`signal(0)`** | `count = signal(0);` <br> `count.set(1);` <br> `count.update(c => c + 1);` |
| **Leer estado (`count`)** | **Llamar al signal (`count()`)** | `<p>{{ cart.totalItems() }}</p>` |
| **`useMemo(() => ...)`** | **`computed(() => ...)`** | `total = computed(() => this.subtotal() + this.envio());` |
| **`useEffect(() => ...)`** | **`effect(() => ...)`** | Se ejecuta reactivamente cuando cambian sus signals. |
| **Zustand / Redux Store** | **Servicio `@Injectable` con Signals** | `CartService`, `OrdersService`, `AuthService` |
| **`cn(...)` (clsx + twMerge)**| **`cn(...)` en `core/utils/cn.ts`** | Idéntico a Shadcn UI |
| **`{condition && <Component />}`**| **`@if (condition) { ... }`** | Nueva sintaxis de control de flujo nativa |
| **`items.map(item => ...)`**| **`@for (item of items(); track item.id) { ... }`** | Rápido y sin necesidad de importar directivas |
| **`Sonner` (Toasts)** | **`ngx-sonner` (`toast.success(...)`)** | `this.notify.showSuccess('Añadido')` |

---

## 🏛️ Arquitectura de Módulos & Alineación con Microservicios

```
src/app/
├── core/
│   ├── auth/                    # Guardias y decoding JWT
│   ├── models/                  # Interfaces de datos (RF01 - RF34)
│   │   ├── user.model.ts        # Modelos de usuario y roles (CLIENTE, ADMIN, CHEF, MOZO)
│   │   ├── product.model.ts     # Productos, categorías y carrito
│   │   ├── order.model.ts       # Máquina de estados (PENDIENTE_PAGO -> PAGADO -> COCINA -> REPARTO -> COMPLETADO)
│   │   ├── payment.model.ts     # Yape, Plin, Tarjeta, Efectivo
│   │   └── table.model.ts       # Mesas de salón
│   ├── services/                # Servicios Reactivos con Signals
│   │   ├── auth.service.ts      # ms-autenticacion (RF01 - RF05)
│   │   ├── products.service.ts  # ms-carta-productos (RF06 - RF10)
│   │   ├── cart.service.ts      # Estado del Carrito y totales
│   │   ├── orders.service.ts    # ms-pedidos (RF13 - RF18)
│   │   ├── notification.service.ts # Toasts (ngx-sonner) + Modales (SweetAlert2)
│   └── utils/cn.ts              # Utilidad cn() para Tailwind CSS
│
├── shared/
│   ├── components/
│   │   ├── navbar/              # Navegación responsiva + badge de carrito + selector de roles
│   │   ├── cart-drawer/         # Drawer lateral de carrito
│   │   ├── order-status-badge/  # Badge con colores semánticos por estado
│   │   └── order-timeline/      # Stepper visual del avance del pedido
│   └── pipes/
│       └── currency-pen.pipe.ts # Formateador a soles peruanos (S/ 74.90)
│
└── features/
    ├── client/
    │   ├── home/                # Hero + Promociones + Acceso directo
    │   ├── menu/                # Carta digital interactiva + filtros + modal de notas
    │   ├── checkout/            # Checkout: Delivery / Salón / Recojo + Métodos de pago
    │   └── order-tracking/      # Seguimiento en vivo por código de orden (RF17)
    ├── kitchen/
    │   └── kitchen-kds.component.ts # Tablero KDS para Cocineros (Avanzar pedidos RF16)
    └── admin/
        └── dashboard/           # Gestión de carta (CRUD RF06 + switch Agotado RF08) y pedidos
```

---

## 🚀 Comandos para Ejecutar

### Servidor de Desarrollo Local
```bash
npm start
# O también:
ng serve
```
Abre en tu navegador: `http://localhost:4200/`

### Compilación para Producción (SSR)
```bash
npm run build
```

---

## 🎨 Paleta de Diseño Gastronómica
- **Brand Primary:** `#f97316` (Naranja Pollería / Fuego)
- **Amber Gold:** `#f59e0b` (Dorado al horno)
- **Dark Charcoal:** `#0c0d0e` / `#141618` (Carbón & Elegancia)
- **Background:** `#f8fafc` (Slate limpio con tarjetas glassmorphism)
