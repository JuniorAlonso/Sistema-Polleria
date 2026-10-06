# 1.4 Pagos — `payments-service`

**Base URL:** `http://localhost:8083`

**Rol:** Gestionar el ciclo de vida transaccional de pagos y habilitar el avance del pedido en la Fase 1. En esta fase se implementa el flujo transaccional base y el modo contraentrega:
1. **Cobro Operativo:** Modo `CONTRAENTREGA` (pago en efectivo al mozo o repartidor) con confirmación administrativa.
2. **Gateways de Simulación / Mock:** Pruebas locales controladas (`TARJETA`, `YAPE_PLIN`) para el desarrollo inicial.

> 💡 **Nota de Arquitectura:** La integración completa y oficial de la pasarela **Mercado Pago** (Checkout Pro, SDK y Webhooks IPN) ha sido separada en su propia fase independiente: [Fase 5 — Pasarela de Pagos Mercado Pago](../fase_5_pagos_mercadopago/README.md).

---

## Entidades

### Pago
| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | `Long` | PK, auto-increment |
| `ordenId` | `Long` | Not null, único (1 pago por orden) |
| `clienteId` | `Long` | Not null |
| `monto` | `BigDecimal(10,2)` | Not null |
| `metodoPago` | `MetodoPago` (enum) | Not null |
| `estado` | `EstadoPago` (enum) | Not null |
| `referenciaExterna` | `String` | Código de la pasarela (ej: `TXN-A1B2C3D4E5F6`, `MP-PREF-xxx`, `MP-PAY-xxx`) |
| `detalle` | `String` | Descripción del resultado |
| `creadoEn` | `LocalDateTime` | Auto-generado |
| `actualizadoEn` | `LocalDateTime` | Auto-actualizado |

### MetodoPago (Enum)
```java
CONTRAENTREGA, TARJETA, YAPE_PLIN
```

### EstadoPago (Enum)
```java
PENDIENTE, APROBADO, RECHAZADO, CANCELADO
```

---

## Gateways y Métodos Soportados (Fase 1)

| Gateway | Tipo | Método de Pago | Comportamiento Técnico |
| :--- | :---: | :--- | :--- |
| `ContraentregaGateway` | Operativo | `CONTRAENTREGA` | Registra el pago en estado `PENDIENTE` hasta que el repartidor o personal de caja confirme el cobro. |
| `TarjetaGateway` | Mock / Test | `TARJETA` | Requiere `tokenPasarela`. Aprueba automáticamente y genera correlativo `TXN-XXXXXXXXXXXX`. |
| `YapePlinGateway` | Mock / Test | `YAPE_PLIN` | Requiere `telefonoYape`. Aprueba automáticamente y genera correlativo `YP-XXXXXXXXXXXX`. |

*(La pasarela oficial con SDK de Mercado Pago se implementa en la [Fase 5](../fase_5_pagos_mercadopago/README.md))*

---

## Endpoints

### 1. Iniciar Pago Directo / Simulado (RF19, RF20)

```
POST /pagos
```

**Acceso:** 🔒 Requiere token JWT con rol `CLIENTE`, `MOZO` o `ADMIN`

**Headers requeridos:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body — Pago con Tarjeta (Mock):**
```json
{
  "ordenId": 42,
  "monto": 204.90,
  "metodoPago": "TARJETA",
  "tokenPasarela": "tok_test_abc123def456",
  "telefonoYape": null
}
```

**Request Body — Pago con Yape/Plin (Mock):**
```json
{
  "ordenId": 42,
  "monto": 204.90,
  "metodoPago": "YAPE_PLIN",
  "tokenPasarela": null,
  "telefonoYape": "987654321"
}
```

**Request Body — Pago Contraentrega (Efectivo):**
```json
{
  "ordenId": 42,
  "monto": 204.90,
  "metodoPago": "CONTRAENTREGA",
  "tokenPasarela": null,
  "telefonoYape": null
}
```

| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `ordenId` | `number` | ✅ | Debe existir en BD y no tener pago previo aprobado |
| `monto` | `number` | ✅ | Mayor a 0.01 |
| `metodoPago` | `string` | ✅ | Enum: `CONTRAENTREGA`, `TARJETA`, `YAPE_PLIN` |
| `tokenPasarela` | `string` | Solo TARJETA | Token del SDK emisor |
| `telefonoYape` | `string` | Solo YAPE_PLIN | Celular asociado |

**Response `201 Created` — Aprobado inmediato (Tarjeta/Yape mock):**
```json
{
  "id": 10,
  "ordenId": 42,
  "clienteId": 7,
  "monto": 204.90,
  "metodoPago": "TARJETA",
  "estado": "APROBADO",
  "referenciaExterna": "TXN-A1B2C3D4E5F6",
  "detalle": "Cargo aprobado por pasarela",
  "creadoEn": "2026-08-23T15:35:00",
  "actualizadoEn": null
}
```

---

### 2. Obtener Pago por ID

```
GET /pagos/{id}
```

**Acceso:** 🔒 `CLIENTE`, `MOZO`, `ADMIN`, `REPARTIDOR`

**Response `200 OK`:** `PagoResponse`

---

### 3. Obtener Pago por Orden

```
GET /pagos/orden/{ordenId}
```

**Acceso:** 🔒 `CLIENTE`, `MOZO`, `ADMIN`, `REPARTIDOR`

**Response `200 OK`:** `PagoResponse`

---

### 4. Mis Pagos — Historial del Cliente

```
GET /pagos/mis-pagos
```

**Acceso:** 🔒 `CLIENTE`, `MOZO`

**Response `200 OK`:** `PagoResponse[]`

---

### 5. Listar Todos los Pagos (RF22)

```
GET /pagos
```

**Acceso:** 🔒 Solo `ADMIN`

**Response `200 OK`:** `PagoResponse[]` ordenados por fecha descendente. Base para el módulo contable y de finanzas.

---

### 6. Confirmar Pago Manualmente (RF20, RF21)

```
PATCH /pagos/{id}/confirmar
```

**Acceso:** 🔒 Solo `ADMIN`, `REPARTIDOR`

**Request Body:**
```json
{
  "referenciaExterna": "EFECTIVO-RECIBIDO-REPARTIDOR-42",
  "detalle": "Cobro en efectivo verificado contraentrega"
}
```

**Response `200 OK`:** `PagoResponse` con estado `APROBADO`.

---

### 7. Cancelar Pago (RF20)

```
PATCH /pagos/{id}/cancelar
```

**Acceso:** 🔒 Solo `ADMIN`, `CLIENTE`

**Response `200 OK`:** `PagoResponse` con estado `CANCELADO`.

---

## Flujos de Pago (Fase 1)

### Flujo Operativo: Pago Contraentrega (Efectivo)
```
Cliente/Frontend              payments-service              Repartidor / Admin
      │                              │                               │
      ├── POST /pagos ──────────────►│                               │
      │   { metodo: CONTRAENTREGA }  │ (Guarda Pago PENDIENTE)       │
      │◄── 201 { estado: PENDIENTE }─┤                               │
      │                              │                               │
      │ (Repartidor entrega pedido y recibe dinero en efectivo)      │
      │                              │                               │
      │                              │◄── PATCH /pagos/{id}/confirmar├──
      │                              │    { referenciaExterna }      │
      │                              │── Pago estado → APROBADO      │
```

---

## Variables de Entorno del Servicio de Pagos

```properties
# Conexión DB y seguridad
DB_URL=jdbc:postgresql://localhost:5432/polleria
DB_USERNAME=postgres
DB_PASSWORD=postgres
JWT_SECRET=super-secret-key-32-characters-minimum

# Comunicación inter-servicio
ORDERS_SERVICE_URL=http://localhost:8082
```
