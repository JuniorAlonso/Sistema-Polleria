# Referencia Rápida de Endpoints — Fase 1

Tabla consolidada de todos los endpoints que el **frontend** debe consumir.

---

## Base URLs

| Servicio | URL Local | Puerto |
| :--- | :--- | :---: |
| auth-service | `http://localhost:8081` | 8081 |
| orders-service | `http://localhost:8082` | 8082 |
| payments-service | `http://localhost:8083` | 8083 |

---

## Autenticación (auth-service → :8081)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/auth/register` | 🔓 | — | Registro de nuevo usuario |
| `POST` | `/auth/login` | 🔓 | — | Login (email o teléfono) |
| `POST` | `/auth/verify-2fa` | 🔓 | — | Verificar código 2FA |
| `POST` | `/auth/refresh` | 🔓 | — | Renovar access token (Refresh Token Rotation) |
| `POST` | `/auth/logout` | 🔓 | — | Cerrar sesión (revocar refresh token) |
| `GET` | `/auth/validate` | 🔒 | Cualquiera | Validar token (uso inter-servicio) |

---

## Productos (orders-service → :8082)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/productos` | 🔓 | — | Listar carta (público, QR) |
| `GET` | `/productos?categoria=X` | 🔓 | — | Filtrar por categoría |
| `GET` | `/productos?soloDisponibles=false` | 🔓 | — | Incluir agotados |
| `GET` | `/productos/{id}` | 🔓 | — | Detalle de un producto |
| `POST` | `/productos` | 🔒 | ADMIN | Crear producto |
| `PUT` | `/productos/{id}` | 🔒 | ADMIN | Actualizar producto |
| `PATCH` | `/productos/{id}/disponibilidad` | 🔒 | ADMIN | Toggle agotado/disponible |
| `DELETE` | `/productos/{id}` | 🔒 | ADMIN | Eliminar producto |

---

## Mesas (orders-service → :8082)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `GET` | `/mesas` | 🔒 | ADMIN, MOZO | Listar todas las mesas |
| `GET` | `/mesas/libres` | 🔒 | ADMIN, MOZO | Listar mesas con estado LIBRE |
| `GET` | `/mesas/{id}` | 🔒 | ADMIN, MOZO | Detalle de una mesa |
| `GET` | `/mesas/{id}/orden-activa` | 🔒 | ADMIN, MOZO | Comanda abierta de la mesa |
| `POST` | `/mesas` | 🔒 | ADMIN | Crear mesa |
| `PUT` | `/mesas/{id}` | 🔒 | ADMIN | Actualizar mesa |
| `PATCH` o `PUT` | `/mesas/{id}/estado` | 🔒 | ADMIN, MOZO | Cambiar estado de una mesa |
| `PATCH` o `PUT` | `/mesas/{id}/posicion` | 🔒 | ADMIN, MOZO | Mover la mesa en el croquis |
| `DELETE` | `/mesas/{id}` | 🔒 | ADMIN | Eliminar mesa |
| `GET` | `/zonas` | 🔓 | — | Zonas del salón (`ZonaSalon`) |
| `PUT` | `/zonas/{id}/dimensiones` | 🔒 | ADMIN, MOZO | Persistir filas y columnas de la zona |

---

## Órdenes (orders-service → :8082)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/ordenes` | 🔓 | — | Crear pedido (permite invitados sin sesión; el dueño se toma del token si existe) |
| `GET` | `/ordenes/{id}` | 🔒 | Dueño, personal o `X-Internal-Key` | Consultar orden (tracking). A cualquier otro le responde `404` |
| `GET` | `/ordenes/mis-ordenes` | 🔒 | Autenticado | Historial del cliente |
| `GET` | `/ordenes/cocina` | 🔒 | ADMIN, COCINA | Órdenes para la cocina (estados `RECIBIDO`/`EN_PREPARACION`) |
| `GET` | `/ordenes/activos` | 🔒 | ADMIN, MOZO | Órdenes activas (no finalizadas) |
| `GET` | `/ordenes` | 🔒 | ADMIN, MOZO, COCINA, REPARTIDOR, CAJERO | Listar |
| `GET` | `/ordenes?estado=X` | 🔒 | ADMIN, MOZO, COCINA, REPARTIDOR, CAJERO | Filtrar por estado |
| `GET` | `/ordenes?soloActivos=true` | 🔒 | ADMIN, MOZO, COCINA, REPARTIDOR, CAJERO | Solo órdenes activas |
| `GET` | `/ordenes/seguimiento` | 🔓 + `X-Seguimiento-Token` | — | Pedidos de un celular verificado (ver Fase 3) |
| `POST` | `/ordenes/seguimiento/codigo` | 🔓 | — | Envía código de 4 dígitos por WhatsApp (ver Fase 3) |
| `POST` | `/ordenes/seguimiento/verificar` | 🔓 | — | Verifica el código y devuelve acceso temporal (ver Fase 3) |
| `PATCH` | `/ordenes/{id}/estado` | 🔒 | Personal: cualquier pedido · `CLIENTE`: solo el suyo y solo a `CANCELADO` | Cambiar estado del pedido (valida transiciones → `400` si es inválida; `403` si un cliente intenta avanzar el flujo; `404` si el pedido no es suyo) |

---

## Pagos (payments-service → :8083)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/pagos` | 🔒 | CLIENTE, MOZO, ADMIN | Iniciar pago (Contraentrega / Mock) |
| `GET` | `/pagos/{id}` | 🔒 | CLIENTE, MOZO, ADMIN, REPARTIDOR | Detalle de un pago |
| `GET` | `/pagos/orden/{ordenId}` | 🔒 | CLIENTE, MOZO, ADMIN, REPARTIDOR | Pago de una orden |
| `GET` | `/pagos/mis-pagos` | 🔒 | CLIENTE, MOZO | Historial de pagos del cliente |
| `GET` | `/pagos` | 🔒 | ADMIN | Todos los pagos |
| `PATCH` | `/pagos/{id}/confirmar` | 🔒 | ADMIN, REPARTIDOR | Confirmar pago (contraentrega) |
| `PATCH` | `/pagos/{id}/cancelar` | 🔒 | ADMIN, CLIENTE | Cancelar pago |

> 💳 *La pasarela oficial de Mercado Pago (Checkout Pro y Webhooks IPN) se encuentra documentada en la [Fase 5](../fase_5_pagos_mercadopago/README.md): `POST /pagos/mercadopago/preferencia`, `POST /pagos/{id}/reembolso` y `POST /pagos/orden/{ordenId}/reembolso`.*  
> 📲 *El microservicio de notificaciones por WhatsApp (`notification-service`) se encuentra documentado en la [Fase 3](../fase_3_notificaciones_whatsapp/README.md).*
> 🏢 *Inventario (`/inventario/*`), finanzas (`/finanzas/*`), feedback (`/feedback/*`) e incidentes (`/incidentes`) están documentados en las Fases 4 y 6.*

---

## Headers Comunes

**Todas las peticiones protegidas (🔒):**
```
Authorization: Bearer <jwt-token>
```

**Peticiones con body (POST, PUT, PATCH):**
```
Content-Type: application/json
```

---

## Leyenda

| Icono | Significado |
| :---: | :--- |
| 🔓 | Acceso público, no requiere token |
| 🔒 | Requiere `Authorization: Bearer <token>` |
