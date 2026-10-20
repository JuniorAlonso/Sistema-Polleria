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
| `canalOrigen` | `CanalOrigen` (enum) | Nullable, max 10. Canal por el que entró el pedido (S1) |
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

### CanalOrigen (Enum)
```java
WEB, WHATSAPP, SALON
```

Registra **por qué canal entró** el pedido (S1), para medir y auditar los pedidos de WhatsApp. La
columna es **nullable** a propósito: las filas creadas antes de esta columna no tienen canal y no
se rompen (`ddl-auto=update` agrega la columna solo). El alta nueva siempre lo resuelve:

| Caso | Canal resultante |
| :--- | :--- |
| El request manda `canalOrigen` | El que mandó (debe ser `WEB`, `WHATSAPP` o `SALON`) |
| Sin `canalOrigen` y `tipo = SALON` | `SALON` |
| Sin `canalOrigen` y cualquier otro tipo | `WEB` |

Ese default (decisión de L5) es lo que mantiene compatible al checkout web actual, que no manda el
campo; el bot de WhatsApp manda `WHATSAPP` explícito. Un canal desconocido (p. ej. `TELEGRAM`)
responde `400` por deserialización y **no** crea pedido.

---

## Máquina de Estados (RF15)

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
| `LISTO` (DELIVERY) | `EN_CAMINO`, `ENTREGADO` |
| `EN_CAMINO` | `ENTREGADO`, `CANCELADO` |
| `ENTREGADO` | _(estado final)_ |
| `CANCELADO` | _(estado final)_ |

Cualquier transición inválida retorna `400: "Transición de estado inválida: X → Y"`.

**Quién puede mover el pedido (flujo obligatorio):**

| Quién | Alcance |
| :--- | :--- |
| `ADMIN`, `MOZO`, `COCINA`, `REPARTIDOR` | Cualquier pedido, cualquier transición válida |
| Microservicio con `X-Internal-Key` (`payments-service`) | Cualquier pedido (así propaga el resultado del pago) |
| `CLIENTE` | **Solo su propio pedido, y solo a `CANCELADO`** |

El cliente no puede enviar `EN_PREPARACION`, `LISTO` ni `ENTREGADO`: el avance por cocina y
reparto lo gestiona la pollería. Un intento de avanzar su propio pedido responde `403` con el
cuerpo genérico del manejador de acceso denegado
(`{"error":"No tienes permisos para esta acción","status":403}` — el mismo que cualquier otro
rechazo de rol, para no revelar la regla interna); un intento sobre el pedido de otro responde
`404` (misma convención que `GET /ordenes/{id}`, para no revelar qué pedidos existen).

Comprobado en vivo contra el stack levantado, con un token `CLIENTE` del dueño del pedido:
`GET /ordenes/{id}` → `200` y `PATCH` a `EN_PREPARACION`, `LISTO` y `ENTREGADO` → `403`, con el
estado del pedido intacto tras los tres intentos.

**Cancelación del invitado (S5):** un pedido anónimo (`clienteId = 0`) no tiene dueño autenticado,
así que `PATCH /ordenes/{id}/estado` le respondía `404` y el cliente que pidió sin cuenta no podía
cancelar. El invitado que ya verificó su celular con el código de WhatsApp cancela por una ruta
solo de cancelación, con la misma identidad temporal que usa el seguimiento:

| Quién | Alcance |
| :--- | :--- |
| Invitado con `X-Seguimiento-Token` | `POST /ordenes/seguimiento/{id}/cancelar`: cancela **su propio** pedido (el `telefonoCliente` canónico coincide con el celular del token) mientras no esté en estado terminal |

Un pedido ajeno o inexistente responde `404` (misma convención anti-enumeración que
`GET /ordenes/{id}`); un token ausente, inválido o vencido responde `400`; y un pedido ya `ENTREGADO`
o `CANCELADO` responde `400` por la máquina de estados. La cancelación se delega en
`OrdenService.actualizarEstado(...)`, de modo que el log, la liberación de mesa y la notificación
son exactamente los mismos que en una cancelación hecha por el personal.

---

## Endpoints

### 1. Crear Pedido (RF13, RF14)

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
| `canalOrigen` | `string` | ❌ | Enum: `WEB`, `WHATSAPP`, `SALON`. Sin él se deriva `SALON` para salón y `WEB` para el resto |
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
  "canalOrigen": "WEB",
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

### 3. Mis Órdenes — Historial del Cliente (RF17)

```
GET /ordenes/mis-ordenes
```

**Acceso:** 🔒 Requiere token JWT. Retorna las órdenes del usuario autenticado (por `clienteId` del JWT).

**Response `200 OK`:** `OrdenResponse[]` ordenados por fecha descendente.

---

### 4. Listar Órdenes para Cocina (RF16)

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

### 7. Actualizar Estado de Orden (RF15, RF16, RF18)

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

### 8. Listar Pedidos Disponibles para Entrega (RF18)

```
GET /ordenes/disponibles
```

**Acceso:** 🔒 Solo `ADMIN`, `REPARTIDOR`

Retorna los pedidos que el repartidor puede tomar: de tipo `DELIVERY`, en estado `LISTO` y sin
`repartidorId`. Ordenados del más viejo al más nuevo. No aparecen los pedidos de salón, ni los de
recojo, ni los delivery que la cocina todavía no terminó, ni los que ya tomó otro repartidor.

**Response `200 OK`:** `OrdenResponse[]`

---

### 9. Tomar un Pedido para Entrega — Reclamo Atómico (RF18)

```
POST /ordenes/{id}/reclamo
```

**Acceso:** 🔒 Solo `ADMIN`, `REPARTIDOR`

Asigna el pedido al repartidor autenticado (`repartidorId` = `userId` del JWT). No recibe cuerpo.

**Response `200 OK`:** `OrdenResponse` con `repartidorId` asignado y **el estado sin cambios**
(sigue en `LISTO`). Pasar a `EN_CAMINO` sigue siendo un `PATCH /ordenes/{id}/estado` aparte, que
ya exige tener repartidor asignado.

**Errores:**
| Código | Cuándo |
| :--- | :--- |
| `404` | El pedido no existe |
| `409` | El pedido ya fue tomado por un repartidor (`"El pedido #N ya fue tomado por un repartidor."`) |
| `409` | No es `DELIVERY` (`"Solo los pedidos de delivery se pueden tomar para entrega…"`) |
| `409` | Es `DELIVERY` pero no está `LISTO` (`"El pedido #N todavía no está listo para entregar…"`) |
| `403` | Un rol que no reparte (`CLIENTE`, `MOZO`, `COCINA`, `CAJERO`) intenta tomarlo |

**Reclamo atómico (S10):** el reparto de un pedido no puede duplicarse. El servicio toma la fila
con bloqueo pesimista (`buscarConBloqueo`) más el `@Version` de la entidad, así que si dos
repartidores reclaman a la vez uno recibe `200` y el otro `409`; en la base queda un único
`repartidorId`. Lo prueba `ReclamoPedidoConcurrenteTest` (seis reclamos simultáneos, exactamente
un ganador).

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
