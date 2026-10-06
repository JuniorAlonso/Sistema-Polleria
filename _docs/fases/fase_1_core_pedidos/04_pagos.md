# 1.4 Pagos — `payments-service`

**Base URL:** `http://localhost:8083`

**Rol:** Validar la transacción para avanzar el estado del pedido. En Fase 1 se usa un **mock** que aprueba automáticamente.

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
| `referenciaExterna` | `String` | Código de la pasarela (ej: `TXN-A1B2C3D4E5F6`) |
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

## Gateways (Pasarelas de Pago)

Los pagos se procesan a través de gateways mock que simulan la respuesta real:

| Gateway | Método de Pago | Comportamiento Mock |
| :--- | :--- | :--- |
| `TarjetaGateway` | `TARJETA` | Requiere `tokenPasarela`. Aprueba automáticamente. Genera `TXN-XXXXXXXXXXXX`. |
| `YapePlinGateway` | `YAPE_PLIN` | Requiere `telefonoYape`. Aprueba automáticamente. Genera `YP-XXXXXXXXXXXX`. |
| `ContraentregaGateway` | `CONTRAENTREGA` | Estado queda `PENDIENTE` hasta confirmación manual. |

> **Nota Fase 1:** Estos gateways simulan respuestas. Para producción se integrarán con Culqi/Niubiz/Izipay.

---

## Endpoints

### 1. Iniciar Pago — Intención de Pago (RF21, RF22)

```
POST /pagos
```

**Acceso:** 🔒 Requiere token JWT con rol `CLIENTE`, `MOZO` o `ADMIN`

**Headers requeridos:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body — Pago con Tarjeta:**
```json
{
  "ordenId": 42,
  "monto": 204.90,
  "metodoPago": "TARJETA",
  "tokenPasarela": "tok_test_abc123def456",
  "telefonoYape": null
}
```

**Request Body — Pago con Yape/Plin:**
```json
{
  "ordenId": 42,
  "monto": 204.90,
  "metodoPago": "YAPE_PLIN",
  "tokenPasarela": null,
  "telefonoYape": "987654321"
}
```

**Request Body — Pago Contraentrega (efectivo):**
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
| `ordenId` | `number` | ✅ | Debe existir, no debe tener pago previo |
| `monto` | `number` | ✅ | > 0.01 |
| `metodoPago` | `string` | ✅ | Enum: `CONTRAENTREGA`, `TARJETA`, `YAPE_PLIN` |
| `tokenPasarela` | `string` | Solo TARJETA | Token generado por el SDK de la pasarela |
| `telefonoYape` | `string` | Solo YAPE_PLIN | Teléfono registrado en Yape/Plin |

**Response `201 Created` — Tarjeta (aprobado inmediato):**
```json
{
  "id": 10,
  "ordenId": 42,
  "clienteId": 7,
  "monto": 204.90,
  "metodoPago": "TARJETA",
  "estado": "APROBADO",
  "referenciaExterna": "TXN-A1B2C3D4E5F6",
  "detalle": "Cargo aprobado por pasarela de tarjeta",
  "creadoEn": "2026-08-23T15:35:00",
  "actualizadoEn": null
}
```

**Response `201 Created` — Contraentrega (pendiente):**
```json
{
  "id": 11,
  "ordenId": 43,
  "clienteId": 7,
  "monto": 65.00,
  "metodoPago": "CONTRAENTREGA",
  "estado": "PENDIENTE",
  "referenciaExterna": "CE-A1B2C3D4E5F6",
  "detalle": "Pago contraentrega registrado — se cobra al entregar",
  "creadoEn": "2026-08-23T15:40:00",
  "actualizadoEn": null
}
```

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | `"Ya existe un pago registrado para la orden X"` |
| `400` | `"Token de pasarela requerido para pago con tarjeta"` |
| `400` | `"Número de teléfono requerido para pago Yape/Plin"` |

---

### 2. Obtener Pago por ID

```
GET /pagos/{id}
```

**Acceso:** 🔒 Requiere token con rol `CLIENTE`, `MOZO`, `ADMIN` o `REPARTIDOR`

**Response `200 OK`:** PagoResponse

---

### 3. Obtener Pago por Orden

```
GET /pagos/orden/{ordenId}
```

**Acceso:** 🔒 Requiere token con rol `CLIENTE`, `MOZO`, `ADMIN` o `REPARTIDOR`

**Response `200 OK`:** PagoResponse del pago asociado a la orden.

**Errores:**
| Código | Causa |
| :--- | :--- |
| `404` | `"No hay pago para la orden X"` |

---

### 4. Mis Pagos — Historial del Cliente

```
GET /pagos/mis-pagos
```

**Acceso:** 🔒 Requiere token con rol `CLIENTE` o `MOZO`

**Response `200 OK`:** `PagoResponse[]` ordenados por fecha descendente.

---

### 5. Listar Todos los Pagos (Admin)

```
GET /pagos
```

**Acceso:** 🔒 Solo `ADMIN`

**Response `200 OK`:** `PagoResponse[]` ordenados por fecha descendente.

---

### 6. Confirmar Pago Manualmente (RF23)

```
PATCH /pagos/{id}/confirmar
```

**Acceso:** 🔒 Solo `ADMIN`, `REPARTIDOR`

**Headers requeridos:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "referenciaExterna": "EFECTIVO-COBRADO-2026-08-23",
  "detalle": "Pago en efectivo recibido por repartidor"
}
```

| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `referenciaExterna` | `string` | ✅ | Referencia del cobro |
| `detalle` | `string` | ❌ | Detalle adicional |

**Response `200 OK`:** PagoResponse con `estado: "APROBADO"`

**Comportamiento:** Al confirmar, el servicio registra un log indicando que la cocina puede procesar la orden.

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | `"No se puede cambiar un pago en estado APROBADO a APROBADO"` (ya confirmado) |
| `400` | `"No se puede cambiar un pago en estado CANCELADO a APROBADO"` |

---

### 7. Cancelar Pago

```
PATCH /pagos/{id}/cancelar
```

**Acceso:** 🔒 Solo `ADMIN`, `CLIENTE`

**Request Body:** Ninguno

**Response `200 OK`:** PagoResponse con `estado: "CANCELADO"`

---

## Flujo de Pago por Método

### Tarjeta (Visa/Mastercard)
```
Frontend                     payments-service         TarjetaGateway (mock)
   │                              │                          │
   ├── POST /pagos ──────────────►│                          │
   │   { metodoPago: "TARJETA",   │── procesar() ──────────►│
   │     tokenPasarela: "tok_x" } │                          │
   │                              │◄── APROBADO + TXN-xxx ──┤
   │◄── 201 { estado: APROBADO } ─┤                          │
```

### Yape / Plin
```
Frontend                     payments-service         YapePlinGateway (mock)
   │                              │                          │
   ├── POST /pagos ──────────────►│                          │
   │   { metodoPago: "YAPE_PLIN", │── procesar() ──────────►│
   │     telefonoYape: "987..." } │                          │
   │                              │◄── APROBADO + YP-xxx ───┤
   │◄── 201 { estado: APROBADO } ─┤                          │
```

### Contraentrega (Efectivo)
```
Frontend                     payments-service      ContraentregaGateway    Repartidor/Admin
   │                              │                       │                     │
   ├── POST /pagos ──────────────►│                       │                     │
   │   { metodoPago:              │── procesar() ────────►│                     │
   │     "CONTRAENTREGA" }        │                       │                     │
   │                              │◄── PENDIENTE + CE-xxx┤                     │
   │◄── 201 { estado: PENDIENTE }─┤                       │                     │
   │                              │                       │                     │
   │  ... entrega física ...      │                       │                     │
   │                              │◄── PATCH /pagos/{id}/confirmar ────────────┤
   │                              │    { referenciaExterna: "EFECTIVO-..." }    │
   │                              │── estado → APROBADO   │                     │
```

---

## Uso desde el Frontend

```typescript
const API = 'http://localhost:8083';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// Pagar con tarjeta
const pago = await fetch(`${API}/pagos`, {
  method: 'POST', headers,
  body: JSON.stringify({
    ordenId: 42,
    monto: 204.90,
    metodoPago: 'TARJETA',
    tokenPasarela: 'tok_test_simulado'
  })
}).then(r => r.json());
// pago.estado === 'APROBADO'

// Pagar con Yape/Plin
const pago = await fetch(`${API}/pagos`, {
  method: 'POST', headers,
  body: JSON.stringify({
    ordenId: 42,
    monto: 204.90,
    metodoPago: 'YAPE_PLIN',
    telefonoYape: '987654321'
  })
}).then(r => r.json());

// Pagar contraentrega
const pago = await fetch(`${API}/pagos`, {
  method: 'POST', headers,
  body: JSON.stringify({
    ordenId: 42,
    monto: 204.90,
    metodoPago: 'CONTRAENTREGA'
  })
}).then(r => r.json());
// pago.estado === 'PENDIENTE'

// Consultar pago de una orden
const pagoOrden = await fetch(`${API}/pagos/orden/42`, { headers })
  .then(r => r.json());

// Repartidor confirma cobro en efectivo
await fetch(`${API}/pagos/${pagoId}/confirmar`, {
  method: 'PATCH', headers,
  body: JSON.stringify({
    referenciaExterna: 'EFECTIVO-2026-08-23-42',
    detalle: 'Cobro realizado al entregar'
  })
});
```
