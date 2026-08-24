# 🚨 FASE 1 — Flujo Crítico del Pedido (Primer Entregable)

**Objetivo:** Permitir que un cliente se autentique, vea la carta, arme un pedido, pague y vea cómo el estado cambia hasta ser entregado.

**Prioridad:** Alta — Obligatoria para el Entregable 1.

---

## Arquitectura General

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  auth-service│      │orders-service│      │payments-svc  │
│  :8081       │      │  :8082       │      │  :8083       │
│              │      │              │      │              │
│ /auth/*      │      │ /productos/* │      │ /pagos/*     │
│              │      │ /ordenes/*   │      │              │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │       JWT compartido (mismo secret)       │
       └─────────────────────┴─────────────────────┘
                             │
                     ┌───────┴───────┐
                     │  PostgreSQL   │
                     │  (AWS RDS)    │
                     └───────────────┘
```

| Servicio | Puerto | Descripción |
| :--- | :---: | :--- |
| `auth-service` | `8081` | Registro, Login, JWT, 2FA, bloqueo IP |
| `orders-service` | `8082` | CRUD productos, gestión de órdenes y estados, mesas |
| `payments-service` | `8083` | Intención de pago, gateways mock (Tarjeta, Yape/Plin, Contraentrega) |
| `notification-service` | — | Placeholder WhatsApp (Fase 2+) |
| **Frontend (Angular 19)** | `4200` | SPA con vistas de Cliente, Admin, Cocina (KDS) |

---

## Microservicios de la Fase 1

| # | Microservicio | Doc detallada |
| :--- | :--- | :--- |
| 1.1 | Autenticación (`auth-service`) | [01_autenticacion.md](./01_autenticacion.md) |
| 1.2 | Carta y Productos (`orders-service` → productos) | [02_carta_productos.md](./02_carta_productos.md) |
| 1.3 | Pedidos y Estados (`orders-service` → órdenes) | [03_pedidos_estados.md](./03_pedidos_estados.md) |
| 1.4 | Pagos (`payments-service`) | [04_pagos.md](./04_pagos.md) |

---

## Matriz de Requerimientos Funcionales Cubiertos

| RF | Descripción | Microservicio | Estado |
| :--- | :--- | :--- | :---: |
| RF01 | Registro de clientes | auth-service | ✅ |
| RF02 | Inicio de sesión (email/teléfono) | auth-service | ✅ |
| RF05 | Verificación en dos pasos (2FA) | auth-service | ✅ (Bonus) |
| RF06 | Bloqueo por IP tras intentos fallidos | auth-service | ✅ (Bonus) |
| RF08 | CRUD de productos (Admin) | orders-service | ✅ |
| RF09 | Listado de productos con precios y foto | orders-service | ✅ |
| RF10 | Marcar producto como "Agotado" | orders-service | ✅ |
| RF11 | Promociones/combos complejos | orders-service | ✅ |
| RF12 | QR físico simulado (link directo) | orders-service | ✅ |
| RF15 | Crear pedido | orders-service | ✅ |
| RF16 | Detalle del pedido con items | orders-service | ✅ |
| RF17 | Consulta de estado del pedido (cliente) | orders-service | ✅ |
| RF18 | Historial de órdenes del cliente | orders-service | ✅ |
| RF19 | Actualización de estado (personal) | orders-service | ✅ |
| RF20 | Asignación de repartidor | orders-service | ✅ (manual) |
| RF21 | Intención de pago | payments-service | ✅ |
| RF22 | Registro de transacción | payments-service | ✅ |
| RF23 | Comunicación REST para cambio de estado | payments-service | ✅ |
| RNF02 | Cifrado BCrypt | auth-service | ✅ |

---

## Requerimientos No Funcionales Cubiertos

| RNF | Descripción | Implementación |
| :--- | :--- | :--- |
| RNF02 | Cifrado de contraseña | `BCryptPasswordEncoder` en auth-service |
| Seguridad | Tokens JWT con expiración configurable | `jwt.expiration-ms` (default: 24h) |
| Seguridad | CORS configurable por entorno | `cors.allowed-origins` en cada servicio |
| Seguridad | Autorización por rol (`@PreAuthorize`) | En cada endpoint protegido |
| BD | PostgreSQL vía AWS RDS | Configurado con variables de entorno |
| BD | Auto-DDL con Hibernate | `ddl-auto=update` |

---

## Variables de Entorno Requeridas

```env
# Comunes a los 3 servicios
DB_URL=jdbc:postgresql://<host>:5432/polleria
DB_USERNAME=postgres
DB_PASSWORD=********
JWT_SECRET=<clave-secreta-compartida>
CORS_ALLOWED_ORIGINS=http://localhost:4200

# Solo auth-service
MAIL_USERNAME=<gmail>
MAIL_PASSWORD=<app-password>
MAX_FAILED_ATTEMPTS=5          # opcional, default: 5
BLOCK_DURATION_MINUTES=15      # opcional, default: 15
TWO_FACTOR_EXPIRY_MINUTES=5    # opcional, default: 5
JWT_EXPIRATION_MS=86400000     # opcional, default: 24h

# Solo payments-service
ORDERS_SERVICE_URL=http://localhost:8082
```

---

## Flujo Completo del Pedido (Happy Path)

```
Cliente                Frontend              auth-service    orders-service    payments-service
  │                       │                       │                │                  │
  ├── Registrarse ───────►├── POST /auth/register►│                │                  │
  │◄── Token JWT ─────────┤◄── AuthResponse ──────┤                │                  │
  │                       │                       │                │                  │
  ├── Ver carta ─────────►├── GET /productos ─────┼───────────────►│                  │
  │◄── Lista productos ──┤◄── ProductoResponse[] ─┼────────────────┤                  │
  │                       │                       │                │                  │
  ├── Armar carrito ─────►│ (local en el front)   │                │                  │
  │                       │                       │                │                  │
  ├── Confirmar pedido ──►├── POST /ordenes ──────┼───────────────►│                  │
  │◄── Orden creada ─────┤◄── OrdenResponse ──────┼────────────────┤                  │
  │                       │                       │                │                  │
  ├── Pagar ─────────────►├── POST /pagos ────────┼────────────────┼─────────────────►│
  │◄── Pago aprobado ────┤◄── PagoResponse ───────┼────────────────┼──────────────────┤
  │                       │                       │                │                  │
  ├── Ver tracking ──────►├── GET /ordenes/{id} ──┼───────────────►│                  │
  │◄── Estado actual ────┤◄── OrdenResponse ──────┼────────────────┤                  │
  │                       │                       │                │                  │
  │     [Cocina / Mozo actualizan PATCH /ordenes/{id}/estado]      │                  │
  │                       │                       │                │                  │
  ├── Polling estado ────►├── GET /ordenes/{id} ──┼───────────────►│                  │
  │◄── ENTREGADO ─────── ┤◄── estado: ENTREGADO ──┼────────────────┤                  │
```

---

## Frontend — Pantallas Implementadas

| Pantalla | Ruta | Componente | Rol |
| :--- | :--- | :--- | :--- |
| Inicio (Landing) | `/` | `home.component.ts` | Público |
| Menú / Carta | `/menu` | `menu.component.ts` | Público |
| Checkout | `/checkout` | `checkout.component.ts` | Cliente |
| Seguimiento de Pedido | `/tracking` | `order-tracking.component.ts` | Cliente |
| Dashboard Admin | `/admin` | `admin-dashboard.component.ts` | Admin |
| KDS Cocina | `/kitchen` | `kitchen-kds.component.ts` | Cocina |
| Login / Registro | Modal | `auth-modal.component.ts` | Público |
