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

## Órdenes (orders-service → :8082)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/ordenes` | 🔒 | Cualquiera | Crear pedido |
| `GET` | `/ordenes/{id}` | 🔒 | Cualquiera | Consultar orden (tracking) |
| `GET` | `/ordenes/mis-ordenes` | 🔒 | Cualquiera | Historial del cliente |
| `GET` | `/ordenes/cocina` | 🔒 | ADMIN, COCINA | Órdenes para la cocina |
| `GET` | `/ordenes/activos` | 🔒 | ADMIN, MOZO | Órdenes activas (no finalizadas) |
| `GET` | `/ordenes?estado=X` | 🔒 | ADMIN, MOZO, COCINA, REPARTIDOR | Filtrar por estado |
| `PATCH` | `/ordenes/{id}/estado` | 🔒 | ADMIN, MOZO, COCINA, REPARTIDOR | Cambiar estado del pedido |

---

## Pagos (payments-service → :8083)

| Método | Endpoint | Auth | Rol | Descripción |
| :---: | :--- | :---: | :--- | :--- |
| `POST` | `/pagos` | 🔒 | CLIENTE, MOZO, ADMIN | Iniciar pago |
| `GET` | `/pagos/{id}` | 🔒 | CLIENTE, MOZO, ADMIN, REPARTIDOR | Detalle de un pago |
| `GET` | `/pagos/orden/{ordenId}` | 🔒 | CLIENTE, MOZO, ADMIN, REPARTIDOR | Pago de una orden |
| `GET` | `/pagos/mis-pagos` | 🔒 | CLIENTE, MOZO | Historial de pagos del cliente |
| `GET` | `/pagos` | 🔒 | ADMIN | Todos los pagos |
| `PATCH` | `/pagos/{id}/confirmar` | 🔒 | ADMIN, REPARTIDOR | Confirmar pago (contraentrega) |
| `PATCH` | `/pagos/{id}/cancelar` | 🔒 | ADMIN, CLIENTE | Cancelar pago |

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
