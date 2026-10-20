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
| `checkoutUrl` | `String` | URL de redirección a checkout (Mercado Pago) |
| `comprobanteClave` | `String` | Clave del objeto del comprobante de Yape en MinIO (T6a). Solo la ve un `ADMIN` |
| `verificadoPor` | `String` | Email del admin que aprobó o rechazó el comprobante (T6c) |
| `verificadoEn` | `LocalDateTime` | Momento de la verificación del comprobante (T6c) |
| `motivoRechazo` | `String` | Motivo del rechazo del comprobante (T6c) |
| `creadoEn` | `LocalDateTime` | Auto-generado |
| `actualizadoEn` | `LocalDateTime` | Auto-actualizado |

### MetodoPago (Enum)
```java
CONTRAENTREGA, TARJETA, YAPE_PLIN
```

### EstadoPago (Enum)
```java
PENDIENTE, APROBADO, RECHAZADO, CANCELADO, REEMBOLSADO, REEMBOLSADO_PARCIAL, PENDIENTE_VERIFICACION
```

`PENDIENTE_VERIFICACION` es el estado del comprobante de Yape recibido por WhatsApp (S6): el
archivo está en MinIO y el pago espera la decisión del administrador. No altera las transiciones de
los estados anteriores.

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

### 8. Registrar la Evidencia del Pago por Yape — interno (RF19, S6)

```
POST /pagos/comprobante
```

**Acceso:** 🔒 Interno — header `X-Internal-Key` (lo llama el `notification-service`, no lleva JWT).

**Request Body:**
```json
{
  "ordenId": 42,
  "telefono": "987654321",
  "monto": 45.50,
  "comprobanteClave": "comprobantes/yape/42/1730000000000-ABC123.jpg"
}
```

**Acción:** crea (o actualiza) el único pago de la orden con `metodoPago = YAPE_PLIN`, estado
`PENDIENTE_VERIFICACION` y la referencia opaca al objeto del comprobante en MinIO. `payments-service`
**no guarda la imagen**: el archivo lo sube el `notification-service` (T6b) y aquí solo vive la
clave. La orden **no** avanza todavía.

**Idempotencia:** mientras el pago esté en `PENDIENTE`, `PENDIENTE_VERIFICACION` o `RECHAZADO`, un
registro nuevo reemplaza el comprobante anterior y reinicia la verificación
(`verificadoPor`/`verificadoEn`/`motivoRechazo` vuelven a `null`). Un pago `APROBADO`, `CANCELADO` o
reembolsado no se pisa nunca: la llamada responde el pago tal como está.

> **Por qué `RECHAZADO` es reemplazable (T6c):** el índice único `uq_pagos_orden_id` permite un solo
> pago por orden y el rechazo no cancela el pedido (queda impago esperando un comprobante válido).
> Sin esta regla, un comprobante rechazado dejaría el pedido imposible de pagar por Yape.

---

### 9. Verificar el Comprobante de Yape — solo ADMIN (RF19, S6, S7)

```
POST /pagos/{id}/verificar
```

**Acceso:** 🔒 **Solo `ADMIN`**. El rol `CAJERO` no se toca: no puede verificar comprobantes.

**Request Body:**
```json
{ "aprobado": true }
```
```json
{ "aprobado": false, "motivoRechazo": "El monto no coincide con el total del pedido" }
```

| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `aprobado` | `boolean` | ✅ | — |
| `motivoRechazo` | `string` | Solo al rechazar | No puede estar vacío; máx. 300 caracteres |

**Response `200 OK`:** `PagoResponse` con el estado resultante.

**Reglas:**

- Solo se puede verificar un pago en `PENDIENTE_VERIFICACION`. En cualquier otro estado responde
  **409** y no cambia nada.
- **Aprobar:** el pago pasa a `APROBADO`, se guardan `verificadoPor` (el email del admin autenticado),
  `verificadoEn` y se limpia `motivoRechazo`. El pedido **avanza** por el mismo mecanismo que usa el
  pago aprobado de Mercado Pago (RF21): `NotificadorOrden` mueve la orden a `EN_PREPARACION`.
- **Rechazar:** el pago pasa a `RECHAZADO` con `verificadoPor`, `verificadoEn` y `motivoRechazo`. La
  orden **no** avanza: queda impaga esperando un comprobante válido (el cliente puede reenviarlo, ver
  la idempotencia de la sección 8). Además, se avisa al cliente por WhatsApp → sección 10.
- Sin token o con un rol distinto de `ADMIN`: **403/401** y el pago no cambia.
- Rechazar sin motivo: **400** y el pago no cambia.

**Ver la imagen del comprobante (URL firmada):**

`GET /pagos/{id}` y `GET /pagos/orden/{ordenId}` incluyen el campo **`comprobanteUrl`** cuando quien
consulta es `ADMIN`: es una URL presignada de MinIO, de vida corta (5 minutos por defecto), para el
objeto del comprobante. El bucket **no** se hace público y a cualquier otro rol (`CLIENTE`, `MOZO`,
`REPARTIDOR`) la respuesta se le entrega **sin** `comprobanteClave` ni `comprobanteUrl`.

```json
{
  "id": 10,
  "ordenId": 42,
  "estado": "PENDIENTE_VERIFICACION",
  "comprobanteClave": "comprobantes/yape/42/1730000000000-ABC123.jpg",
  "comprobanteUrl": "http://localhost:9000/polleria-comprobantes/comprobantes/yape/...?X-Amz-Signature=..."
}
```

---

### 10. Aviso al cliente cuando se rechaza el comprobante (T6d, S6/S13)

El rechazo de la sección 9 no cancela el pedido: queda impago esperando un comprobante válido. Para que el
cliente se entere, `PagoService` llama a
`WhatsappNotificationClient.notificarComprobanteRechazado(ordenId, motivo)`, el **mismo** cliente HTTP que usa
el pago aprobado de Mercado Pago. Ese cliente resuelve el contacto desde `GET /ordenes/{id}` (solo si la orden
es `DELIVERY` y tiene teléfono) y llama al endpoint interno del notification-service:

```
POST /api/notificaciones/whatsapp/comprobante-rechazado
{ "ordenId": 42, "numeroPedido": 3, "telefono": "51999888777", "nombreCliente": "...", "motivo": "..." }
```

El notification-service arma el mensaje con el número de pedido que ve el cliente y el motivo, y lo encola en
su cola única (ver §4.3.3 de `_docs/fases/fase_3_notificaciones_whatsapp/README.md`).

**Orden garantizado (`afterCommit`):** el aviso se encola **después de que la transacción del rechazo
confirma**. Tres consecuencias, todas probadas en `AvisoRechazoComprobanteYapeTest`:

1. Si el aviso falla (notification-service caído), el pago **igual** queda `RECHAZADO` y el admin recibe su
   `200`: el aviso es *best-effort* y no puede revertir la transacción.
2. Cuando el aviso sale, el rechazo **ya está comprometido** en la base (comprobado con una conexión nueva).
3. Aprobar no dispara este aviso.

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

# MinIO — comprobantes de Yape (T6b/T6c). Mismos nombres y defaults que el notification-service
MINIO_ENDPOINT=localhost           # Debe ser alcanzable por el navegador del panel: con el compose,
                                   # localhost:9000 está mapeado. Un nombre interno de Docker (`minio`)
                                   # no resuelve desde el navegador.
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin        # credenciales de desarrollo
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=polleria-comprobantes
MINIO_URL_EXPIRACION_SEGUNDOS=300  # vida de la URL firmada que ve el ADMIN
```
