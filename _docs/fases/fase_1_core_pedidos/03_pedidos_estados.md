# 1.3 Pedidos y Estados — `orders-service` (módulo Órdenes)

**Base URL:** `http://localhost:8082`

**Rol:** El cerebro del sistema. Gestiona el ciclo de vida completo del pedido desde su creación hasta la entrega.

---

## Entidades

### Orden
| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | `Long` | PK, auto-increment |
| `tipo` | `OrdenTipo` (enum) | Not null |
| `estado` | `OrdenEstado` (enum) | Not null, default `RECIBIDO` |
| `clienteId` | `Long` | ID del usuario (del JWT) |
| `mozoId` | `Long` | ID del mozo que tomó el pedido |
| `repartidorId` | `Long` | ID del repartidor asignado |
| `mesa` | `Mesa` (FK) | Solo para tipo `SALON` |
| `direccionEntrega` | `String` | Solo para tipo `DELIVERY`, max 300 |
| `referencia` | `String` | Referencia de dirección, max 200 |
| `nombreCliente` | `String` | Max 100 |
| `telefonoCliente` | `String` | Max 20 |
| `total` | `BigDecimal(10,2)` | Calculado automáticamente |
| `observaciones` | `String` | Max 500 |
| `creadoEn` | `LocalDateTime` | Auto-generado |
| `actualizadoEn` | `LocalDateTime` | Auto-actualizado |
| `items` | `List<OrdenItem>` | Cascade ALL, orphanRemoval |

### OrdenItem
| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | `Long` | PK, auto-increment |
| `orden` | `Orden` (FK) | Not null |
| `producto` | `Producto` (FK) | Not null |
| `cantidad` | `int` | Not null |
| `precioUnitario` | `BigDecimal` | Precio al momento de crear la orden |
| `subtotal` | `BigDecimal` | `precioUnitario × cantidad` |
| `notas` | `String` | Notas especiales del cliente |

### OrdenTipo (Enum)
```java
SALON, DELIVERY, RECOJO
```

### OrdenEstado (Enum)
```java
RECIBIDO, EN_PREPARACION, LISTO, EN_CAMINO, ENTREGADO, CANCELADO
```

---

## Máquina de Estados

```
                ┌──────────────┐
                │   RECIBIDO   │ ← Estado inicial al crear orden
                └──────┬───────┘
                       │
                       ▼
              ┌──────────────────┐
              │  EN_PREPARACION  │ ← Cocina acepta la orden
              └──────┬───────────┘
                     │
                     ▼
               ┌───────────┐
               │   LISTO   │ ← Cocina terminó de preparar
               └─────┬─────┘
                     │
          ┌──────────┼──────────┐
          │ SALON/RECOJO        │ DELIVERY
          ▼                     ▼
    ┌───────────┐        ┌───────────┐
    │ ENTREGADO │        │ EN_CAMINO │ ← Repartidor sale
    └───────────┘        └─────┬─────┘
                               │
                               ▼
                         ┌───────────┐
                         │ ENTREGADO │
                         └───────────┘

        ── Desde cualquier estado activo ──►  CANCELADO
```

**Transiciones válidas:**
| Estado Actual | → Puede ir a |
| :--- | :--- |
| `RECIBIDO` | `EN_PREPARACION`, `CANCELADO` |
| `EN_PREPARACION` | `LISTO`, `CANCELADO` |
| `LISTO` (SALON/RECOJO) | `ENTREGADO` |
| `LISTO` (DELIVERY) | `EN_CAMINO` |
| `EN_CAMINO` | `ENTREGADO`, `CANCELADO` |
| `ENTREGADO` | _(estado final)_ |
| `CANCELADO` | _(estado final)_ |

Cualquier transición inválida retorna `400: "Transición de estado inválida: X → Y"`.

---

## Endpoints

### 1. Crear Pedido (RF15, RF16)

```
POST /ordenes
```

**Acceso:** 🔒 Requiere token JWT (cualquier usuario autenticado)

**Request Body — Pedido Delivery:**
```json
{
  "tipo": "DELIVERY",
  "direccionEntrega": "Av. Los Maestros 450, Ica",
  "referencia": "Frente al parque central",
  "nombreCliente": "Juan Pérez",
  "telefonoCliente": "987654321",
  "observaciones": "Tocar el timbre 2 veces",
  "items": [
    {
      "productoId": 1,
      "cantidad": 2,
      "notas": "Sin ensalada"
    },
    {
      "productoId": 5,
      "cantidad": 1,
      "notas": null
    }
  ]
}
```

**Request Body — Pedido Salón:**
```json
{
  "tipo": "SALON",
  "mesaId": 5,
  "observaciones": "Cumpleaños, llevar vela",
  "items": [
    {
      "productoId": 4,
      "cantidad": 1,
      "notas": "Papas extra crocantes"
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `tipo` | `string` | ✅ | Enum: `SALON`, `DELIVERY`, `RECOJO` |
| `mesaId` | `number` | Solo SALON | Obligatorio si `tipo = SALON` |
| `direccionEntrega` | `string` | Solo DELIVERY | Obligatorio si `tipo = DELIVERY` |
| `referencia` | `string` | ❌ | — |
| `nombreCliente` | `string` | ❌ | — |
| `telefonoCliente` | `string` | ❌ | — |
| `observaciones` | `string` | ❌ | — |
| `items` | `array` | ✅ | Min 1 item |
| `items[].productoId` | `number` | ✅ | Debe existir en BD |
| `items[].cantidad` | `number` | ✅ | Min 1 |
| `items[].notas` | `string` | ❌ | — |

**Response `201 Created`:**
```json
{
  "id": 42,
  "tipo": "DELIVERY",
  "estado": "RECIBIDO",
  "clienteId": 7,
  "mozoId": null,
  "repartidorId": null,
  "mesaNumero": null,
  "direccionEntrega": "Av. Los Maestros 450, Ica",
  "referencia": "Frente al parque central",
  "nombreCliente": "Juan Pérez",
  "telefonoCliente": "987654321",
  "total": 204.90,
  "observaciones": "Tocar el timbre 2 veces",
  "creadoEn": "2026-08-23T15:30:00",
  "actualizadoEn": null,
  "items": [
    {
      "productoId": 1,
      "productoNombre": "Pollo Entero a la Brasa",
      "cantidad": 2,
      "precioUnitario": 65.00,
      "subtotal": 130.00,
      "notas": "Sin ensalada"
    },
    {
      "productoId": 5,
      "productoNombre": "Combo Banquete San Pollo",
      "cantidad": 1,
      "precioUnitario": 74.90,
      "subtotal": 74.90,
      "notas": null
    }
  ]
}
```

**Validaciones automáticas:**
- Si un producto está marcado como `disponible = false` (agotado), se rechaza con `400: "El producto 'X' está agotado"`.
- El `precioUnitario` se toma del precio actual en BD (no del frontend).
- El `total` se calcula como la suma de todos los `subtotal` de los items.
- Para `SALON`, la mesa se marca como `OCUPADA`.

---

### 2. Obtener Orden por ID (RF17)

```
GET /ordenes/{id}
```

**Acceso:** 🔒 Requiere token JWT (cualquier usuario autenticado)

**Response `200 OK`:** _(mismo formato OrdenResponse que arriba)_

---

### 3. Mis Órdenes — Historial del Cliente (RF18)

```
GET /ordenes/mis-ordenes
```

**Acceso:** 🔒 Requiere token JWT. Retorna las órdenes del usuario autenticado (por `clienteId` del JWT).

**Response `200 OK`:** `OrdenResponse[]` ordenados por fecha descendente.

---

### 4. Listar Órdenes para Cocina (RF19)

```
GET /ordenes/cocina
```

**Acceso:** 🔒 Solo `ADMIN`, `COCINA`

Retorna las órdenes en estado `RECIBIDO` o `EN_PREPARACION`, ordenadas por antigüedad (la más vieja primero).

**Response `200 OK`:** `OrdenResponse[]`

---

### 5. Listar Órdenes Activas

```
GET /ordenes/activos
```

**Acceso:** 🔒 Solo `ADMIN`, `MOZO`

Retorna todas las órdenes que NO estén en `ENTREGADO` ni `CANCELADO`.

**Response `200 OK`:** `OrdenResponse[]`

---

### 6. Listar por Estado

```
GET /ordenes?estado={estado}
```

**Acceso:** 🔒 Solo `ADMIN`, `MOZO`, `COCINA`, `REPARTIDOR`

| Parámetro | Tipo | Descripción |
| :--- | :--- | :--- |
| `estado` | `string` | Opcional. Enum: `RECIBIDO`, `EN_PREPARACION`, `LISTO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO` |

Si no se envía `estado`, retorna las órdenes activas (equivale a `/ordenes/activos`).

---

### 7. Actualizar Estado de Orden (RF19, RF20)

```
PATCH /ordenes/{id}/estado
```

**Acceso:** 🔒 Solo `ADMIN`, `MOZO`, `COCINA`, `REPARTIDOR`

**Request Body:**
```json
{
  "estado": "EN_PREPARACION",
  "repartidorId": null
}
```

| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `estado` | `string` | ✅ | Nuevo estado (debe ser transición válida) |
| `repartidorId` | `number` | ❌ | Solo para asignar repartidor en DELIVERY |

**Ejemplo — Cocina acepta pedido:**
```json
{ "estado": "EN_PREPARACION" }
```

**Ejemplo — Cocina termina preparación:**
```json
{ "estado": "LISTO" }
```

**Ejemplo — Asignar repartidor y despachar:**
```json
{ "estado": "EN_CAMINO", "repartidorId": 15 }
```

**Ejemplo — Repartidor entrega:**
```json
{ "estado": "ENTREGADO" }
```

**Response `200 OK`:** OrdenResponse con el estado actualizado.

**Comportamiento adicional:**
- Cuando una orden `SALON` pasa a `ENTREGADO` o `CANCELADO`, la mesa asociada se libera automáticamente (estado → `LIBRE`).

---

## Uso desde el Frontend

```typescript
const API = 'http://localhost:8082';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// Crear pedido delivery
const orden = await fetch(`${API}/ordenes`, {
  method: 'POST', headers,
  body: JSON.stringify({
    tipo: 'DELIVERY',
    direccionEntrega: 'Av. Los Maestros 450',
    items: [
      { productoId: 1, cantidad: 2, notas: 'Sin ají' }
    ]
  })
}).then(r => r.json());

// Consultar estado (polling cada N segundos)
const estado = await fetch(`${API}/ordenes/${orden.id}`, { headers })
  .then(r => r.json());

// Mis órdenes (historial)
const historial = await fetch(`${API}/ordenes/mis-ordenes`, { headers })
  .then(r => r.json());

// Cocina: aceptar pedido
await fetch(`${API}/ordenes/${id}/estado`, {
  method: 'PATCH', headers,
  body: JSON.stringify({ estado: 'EN_PREPARACION' })
});

// Cocina: marcar listo
await fetch(`${API}/ordenes/${id}/estado`, {
  method: 'PATCH', headers,
  body: JSON.stringify({ estado: 'LISTO' })
});
```
