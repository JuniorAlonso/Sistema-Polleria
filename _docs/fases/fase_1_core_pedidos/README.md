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
| `auth-service` | `8081` | Registro, Login, Logout, JWT RTR, 2FA por correo, bloqueo temporal de IP |
| `orders-service` | `8082` | CRUD productos, gestión de órdenes, máquina de estados, mesas |
| `payments-service` | `8083` | Gestión de transacciones, máquina de estados de pagos, cobro contraentrega y gateways mock |
| **Frontend (Angular 19)** | `4200` | SPA con vistas de Cliente, Admin, Cocina (KDS) y Tracking |

---

## Microservicios de la Fase 1

| # | Microservicio | Doc detallada |
| :--- | :--- | :--- |
| 1.1 | Autenticación (`auth-service`) | [01_autenticacion.md](./01_autenticacion.md) |
| 1.2 | Carta y Productos (`orders-service` → productos) | [02_carta_productos.md](./02_carta_productos.md) |
| 1.3 | Pedidos y Estados (`orders-service` → órdenes) | [03_pedidos_estados.md](./03_pedidos_estados.md) |
| 1.4 | Pagos (`payments-service`) | [04_pagos.md](./04_pagos.md) |
| 1.5 | Referencia Rápida de Endpoints | [05_endpoints_referencia_rapida.md](./05_endpoints_referencia_rapida.md) |
| 1.6 | Guía de Pruebas de Endpoints | [06_guia_pruebas_endpoints.md](./06_guia_pruebas_endpoints.md) |
| 1.7 | Guía de Integración Frontend & Hardening | [07_guia_integracion_frontend_y_arquitectura.md](./07_guia_integracion_frontend_y_arquitectura.md) |
| 📑 | **Matriz Maestra de Trazabilidad UTP** | [MATRIZ_TRAZABILIDAD_REQUERIMIENTOS.md](../../MATRIZ_TRAZABILIDAD_REQUERIMIENTOS.md) |

---

## Matriz de Requerimientos Funcionales Cubiertos (Oficial UTP)

Alineada 1:1 con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| RF Oficial | Descripción Oficial | Microservicio | Implementación | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **RF01** | Registro de clientes (nombre, correo, celular y contraseña) | `auth-service` | `POST /auth/register` | ✅ |
| **RF02** | Inicio de sesión mediante correo o celular y contraseña | `auth-service` | `POST /auth/login` | ✅ |
| **RF03** | Cierre de sesión activa e invalidación de tokens | `auth-service` | `POST /auth/logout` | ✅ |
| **RF04** | Verificación en dos pasos (2FA) para personal y administradores | `auth-service` | `POST /auth/verify-2fa` (Spring Mail) | ✅ |
| **RF05** | Bloqueo temporal tras múltiples intentos fallidos (protección IP) | `auth-service` | `IpBlockingService` (5 intentos = 15m) | ✅ |
| **RF06** | Administrador gestiona (CRUD) los productos de la carta | `orders-service` | `/productos` (POST, PUT, DELETE) | ✅ |
| **RF07** | Visualizar carta de productos con precios e imágenes | `orders-service` | `GET /productos` (Público / QR) | ✅ |
| **RF08** | Marcar productos como "agotados" ocultándolos de la carta | `orders-service` | `PATCH /productos/{id}/disponibilidad` | ✅ |
| **RF09** | Crear y gestionar promociones y combos de productos | `orders-service` | Categorías `COMBO` y `PROMOCION` | ✅ |
| **RF10** | Acceso a la carta digital mediante escaneo de código QR | `orders-service` | Carta pública + `Mesa.qrUrl` | ✅ |
| **RF13** | Registrar pedidos (salón, delivery o recojo) | `orders-service` | `POST /ordenes` (`SALON, DELIVERY, RECOJO`) | ✅ |
| **RF14** | Requerir dirección y referencia para delivery | `orders-service` | Validación en `CrearOrdenRequest` | ✅ |
| **RF15** | Máquina de estados robusta para el ciclo de vida del pedido | `orders-service` | `RECIBIDO → EN_PREP → LISTO → EN_CAMINO → ENTREGADO` | ✅ |
| **RF16** | Personal de cocina y admin actualiza estado de pedidos | `orders-service` | `PATCH /ordenes/{id}/estado` | ✅ |
| **RF17** | Clientes consultan el estado actual de su pedido | `orders-service` | `GET /ordenes/{id}` | ✅ |
| **RF18** | Asignación de repartidor a pedidos de delivery | `orders-service` | Campo `repartidorId` en `PATCH /ordenes/{id}/estado` | ✅ (Manual) |
| **RF19** | Métodos de pago (contraentrega, tarjeta, monederos Yape/Plin) | `payments-service` | `POST /pagos` (`CONTRAENTREGA` y simulación mock de desarrollo) | ✅ |
| **RF20** | Registrar cada transacción con su estado | `payments-service` | `EstadoPago` (`PENDIENTE, APROBADO, RECHAZADO, CANCELADO`) | ✅ |
| **RF21** | Actualización automática de estado según pasarela | `payments-service` | Feign/REST hacia `orders-service` al confirmar cobro (*Pasarela Mercado Pago migrada a Fase 5*) | ✅ |

---

## Requerimientos No Funcionales Cubiertos

| RNF Oficial | Descripción | Implementación Técnica |
| :---: | :--- | :--- |
| **RNF01** | Disponibilidad continua del servicio | Despliegue en contenedores Docker / Cloud Run con health checks |
| **RNF02** | Cifrado seguro de contraseñas | `BCryptPasswordEncoder` con factor de coste estándar en `auth-service` |
| **RNF03** | Comunicación protegida y validación JWT | HTTPS en edge / TLS y `JwtAuthFilter` validando cada petición |
| **RNF04** | Políticas CORS restrictivas | `cors.allowed-origins` configurado por entorno en cada backend |
| **RNF05** | Bloqueo automático de IPs sospechosas | `IpBlockingService` sin intervención manual |
| **RNF07** | Actualización de pedidos en tiempo cuasi-real | Polling corto en frontend (Fase 1) y eventos automáticos |
| **RNF08** | Arquitectura desacoplada en microservicios | Servicios independientes (`auth`, `orders`, `payments`) |
| **RNF09** | Registro automático de cancelación de pagos | Manejo de cancelaciones de pago y transiciones en `payments-service` |
| **RNF11** | Código limpio, documentado y control de versiones | Conventional Commits, arquitectura limpia y documentación técnica viva |
| **RNF12** | Portabilidad multi-entorno | Variables de entorno estrictas (`DB_URL`, `JWT_SECRET`, etc.) |
| **RNF13** | Trazabilidad y logs estructurados | SLF4J / Logback con logs de transacciones y excepciones |
| **RNF14** | Usabilidad e interfaz responsiva | Angular 19 adaptado a smartphones, tablets y desktops |

---

## Variables de Entorno Requeridas

```env
# Comunes a los servicios Spring Boot
DB_URL=jdbc:postgresql://<host>:5432/polleria
DB_USERNAME=postgres
DB_PASSWORD=********
JWT_SECRET=<clave-secreta-compartida-min-256-bits>
CORS_ALLOWED_ORIGINS=http://localhost:4200

# Solo auth-service (:8081)
MAIL_USERNAME=<gmail-account>
MAIL_PASSWORD=<google-app-password>
MAX_FAILED_ATTEMPTS=5          # opcional, default: 5
BLOCK_DURATION_MINUTES=15      # opcional, default: 15
TWO_FACTOR_EXPIRY_MINUTES=5    # opcional, default: 5
JWT_EXPIRATION_MS=86400000     # 24h dev / 900000 (15m) prod
JWT_REFRESH_EXPIRATION_MS=604800000 # 7 días

# Solo payments-service (:8083)
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
