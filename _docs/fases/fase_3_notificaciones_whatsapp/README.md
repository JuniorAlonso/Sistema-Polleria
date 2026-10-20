# 📲 FASE 3 — Notificaciones WhatsApp (`notification-service`)

**Objetivo:** Implementar el motor de mensajería automática vía WhatsApp para confirmar pagos y notificar cambios de estado en pedidos de delivery, con cola anti-baneo y trazabilidad de envíos.

**Prioridad:** Media — Integración externa independiente asignada a compañero de equipo.

> ⚠️ **Fase Independiente:** Esta fase es autocontenida y puede desarrollarse, probarse y desplegarse de forma independiente por un miembro del equipo sin depender de las demás fases en progreso.

---

## 1. Arquitectura del Motor de Notificaciones

```
┌──────────────────────┐        ┌──────────────────────┐
│ orders-service       │        │ payments-service     │
│ :8082                │        │ :8083                │
│                      │        │                      │
│ Trigger al cambiar   │        │ Trigger al confirmar │
│ estado de delivery   │        │ pago de delivery     │
└──────────┬───────────┘        └──────────┬───────────┘
           │ HTTP POST                      │ HTTP POST
           │ /api/notificaciones/           │ /api/notificaciones/
           │ whatsapp/estado                │ whatsapp/pago
           ▼                                ▼
┌──────────────────────────────────────────────────────┐
│              notification-service (:3001)             │
│  ┌────────────────────────────────────────────────┐   │
│  │   Cola FIFO Secuencial (queue.js / setTimeout) │   │
│  │   Delay estricto: 10.000 ms entre mensajes     │   │
│  └─────────────────────┬──────────────────────────┘   │
│                        ▼                               │
│           whatsapp-web.js Engine                       │
│           (Sesión QR persistida en disco)              │
└────────────────────────┬──────────────────────────────┘
                         ▼
                WhatsApp Messenger
                (Celular del cliente)
```

| Componente | Tecnología | Rol |
| :--- | :---: | :--- |
| `notification-service` | Node.js 18+ / Express | Motor de envío con cola anti-baneo y registro de trazabilidad |
| `whatsapp-web.js` | Librería NPM | Cliente de WhatsApp Web para envío programático de mensajes |
| Cola propia | `src/notifications/queue.js` | Cola FIFO con concurrencia 1 y delay de 10 s entre envíos (no se usa `p-queue`, que no existe como dependencia) |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código | Tipo | Descripción Oficial | Componente Responsable |
| :--- | :---: | :--- | :--- |
| **RF30** | RF | Notificación WhatsApp al cliente al confirmarse el pago de delivery. | `notification-service` |
| **RF31** | RF | Notificaciones WhatsApp automáticas en cada cambio de estado de delivery (`EN_PREPARACION`, `EN_CAMINO`, `ENTREGADO`). | `orders-service` → `notification-service` |
| **RF32** | RF | Registro y auditoría del estado de envío de notificaciones (`EN_COLA`, `ENVIADO`, `ERROR`). | `notification-service` |
| **RNF10** | RNF | Rate-limiting de 10 segundos de espera entre mensajes en WhatsApp.js para evitar bloqueos por Meta. | `notification-service` (Queue Worker) |

---

## 3. Arquitectura Anti-Ban (RNF10)

WhatsApp Web bloquea números si detecta ráfagas simultáneas automatizadas. Se implementa una **cola secuencial** con delay estricto:

```
[ Petición A ] ──┐
[ Petición B ] ──┼──► [ Cola FIFO de Envíos ] ──► [ Delay 10s ] ──► Envío WWebJS ──► [ DB Log ]
[ Petición C ] ──┘
```

### 3.1 Base Funcional Existente en Fase 1 (histórico)
El punto de partida de la Fase 1 fue un servicio base funcional en `polleria/notification-service/main.js` (puerto `:3001`) con:
- Endpoint básico directo `POST /notificar` (recibía `{ telefono, orderId, estado, nombreCliente }`).
- Endpoint de verificación `GET /status` (estado de conexión de WhatsApp Web).
- Cliente `whatsapp-web.js` con inicialización QR en terminal.

**Alcance desarrollado en Fase 3:** reemplazar los envíos síncronos directos por una cola FIFO con delay estricto de 10 s (RNF10), endpoints REST desacoplados por tipo de evento y persistencia de logs para auditoría de envíos (RF32).

> ✅ **Implementado.** `POST /notificar` **ya no existe** en el código actual (ni siquiera como ruta): fue reemplazado por los endpoints de la sección 4. `GET /status` sí se conserva, bajo el prefijo `/api/notificaciones`. La versión anterior del arranque se conserva en `main-backup.js`, que no se ejecuta.

### 3.2 Implementación Técnica de la Cola Anti-Ban

La implementación final usa una cola propia (`src/notifications/queue.js`) en lugar de `p-queue`, porque las versiones actuales de `p-queue` solo funcionan como ES Module y el servicio usa CommonJS. El comportamiento es el mismo:

- Un solo envío a la vez (concurrencia 1), en orden FIFO.
- Al menos `WHATSAPP_RATE_LIMIT_MS` (10.000 ms) entre un envío y el siguiente.
- Si un envío falla, se registra y la cola continúa con el siguiente.
- Los fallos temporales se reintentan hasta `WHATSAPP_MAX_INTENTOS` (3). Un número sin WhatsApp pasa directo a `ERROR`, sin reintentos.
- Si WhatsApp aún no está conectado (esperando QR), la cola espera a que lo esté.
- Al reiniciar el servicio, los registros que quedaron `EN_COLA` se vuelven a encolar.

Pseudocódigo de referencia (diseño original):

```javascript
const PQueue = require('p-queue');

const messageQueue = new PQueue({
  concurrency: 1,       // Un solo mensaje a la vez
  interval: 10000,      // 10 segundos entre ejecuciones
  intervalCap: 1         // Máximo 1 mensaje por intervalo
});

async function enqueueMessage(notification) {
  // Registrar en BD como EN_COLA
  const log = await NotificationLog.create({
    ordenId: notification.ordenId,
    destinatario: notification.telefono,
    tipo: notification.tipo,
    mensaje: notification.mensaje,
    estado: 'EN_COLA',
    intentos: 0
  });

  messageQueue.add(async () => {
    try {
      await whatsappClient.sendMessage(
        `${notification.telefono}@c.us`,
        notification.mensaje
      );
      log.estado = 'ENVIADO';
      log.intentos += 1;
      log.enviadoEn = new Date();
    } catch (error) {
      log.estado = 'ERROR';
      log.intentos += 1;
      log.errorDetalle = error.message;
    }
    await log.save();
  });
}
```

### 3.3 Una sola cola para todo lo saliente (T4, S2)

Hasta la fase 2 solo pasaban por la cola las notificaciones de pedido: las respuestas del chatbot se enviaban con `msg.reply` directo. Un pedido conversacional son 6-10 mensajes seguidos sin espaciado, justo el patrón que Meta bloquea. Ahora el chatbot **devuelve el texto** (`processMessage`) y el handler lo encola en la **misma** `ColaEnvios` que las notificaciones (`NotificacionService.encolarRespuesta`). No existe un segundo camino de salida.

Antes de cada envío el servicio humaniza el saliente (`src/outbound/humanizacion.js`):

- `marcarVisto(chatId)` (`sendSeen`) solo en respuestas a una conversación entrante.
- `escribiendo(chatId, duracionMs)` (`sendStateTyping`), con duración proporcional al largo del texto y acotada entre `WHATSAPP_TYPING_MIN_MS` y `WHATSAPP_TYPING_MAX_MS`. Es best-effort: si falla, el mensaje igual se envía.

El delay entre envíos consecutivos deja de ser exacto: es `WHATSAPP_RATE_LIMIT_MS` ± `WHATSAPP_JITTER_PCT` por ciento. Con `jitterPct = 0` vuelve a ser el delay fijo original (RNF10).

La configuración vive **en memoria** (`src/outbound/ajustes.js`, S8): los defaults salen de variables de entorno y se pueden editar en caliente con `actualizar(cambios)`; se pierden al reiniciar el proceso y ese es el comportamiento pedido. T4 trajo el store y su uso; T5 lo expone por HTTP al panel (`GET`/`PATCH /api/notificaciones/ajustes`, §4.7) y el presupuesto/ventana/circuit breaker son T4b.

El azar y los timers son inyectables (`azar`, `dormir`, `ahora` en `ColaEnvios`) para que los tests sean deterministas: el jitter no llama a `Math.random` ni espera con `setTimeout` real durante la suite.

### 3.4 Anti-baneo II: presupuesto, ventana horaria y circuit breaker (T4b, S2/S8)

Sobre la misma cola única de T4 se agrega un **gobernador** en memoria (`src/outbound/gobernador.js`) que la cola consulta antes de tomar cada trabajo. Si hay pausa, el trabajo **no se descarta**: queda encolado y la cola se reanuda sola cuando vence la espera. `GET /status` reporta si la cola está pausada y el motivo.

**Presupuesto de envíos** (`src/outbound/limites.js`)

- `WHATSAPP_PRESUPUESTO_HORA` (default 40) y `WHATSAPP_PRESUPUESTO_DIA` (default 500) limitan los mensajes **enviados con éxito** por hora y por día, en hora local del proceso.
- Al agotarse, la cola se pausa hasta que empieza una hora o un día nuevos; los contadores se reinician solos. Motivos en `/status`: `presupuesto-hora`, `presupuesto-dia`.

**Ventana horaria de envío**

- `WHATSAPP_HORA_DESDE` (default 11) y `WHATSAPP_HORA_HASTA` (default 23) definen la ventana `[desde, hasta)`: por defecto se envía de 11:00 a 22:59, el horario de atención del negocio. Fuera de la ventana la cola **espera, no descarta**. Motivo en `/status`: `fuera-de-ventana`.
- Si `horaDesde > horaHasta` la ventana cruza la medianoche; si son iguales queda abierta las 24 h.

**Circuit breaker** (`src/outbound/breaker.js`)

- La detección es **heurística**: no hay un código de error oficial de WhatsApp Web, así que se busca en el mensaje del error alguna de las señales conocidas (`PATRONES_BLOQUEO`): `rate-overlimit`, `too many requests`, `429` y `blocked`/`banned` (número bloqueado). Cada patrón tiene un nombre legible que se expone en `/status`, de modo que siempre se puede leer **por qué** se abrió. Un error que no coincide con ningún patrón no abre el breaker: se maneja con los reintentos normales.
- Al abrirse, la cola global se pausa y se aplica un backoff exponencial acotado: `min(WHATSAPP_BREAKER_BASE_MS × 2^aperturas, WHATSAPP_BREAKER_MAX_MS)` (defaults: 60.000 ms y 15 min).
- Al vencer el backoff el breaker pasa a **medio abierto** y deja pasar **un** envío de prueba; si sale bien, cierra y resetea el backoff. Si vuelve a fallar con una señal de bloqueo, reabre con el doble de espera, hasta el tope.
- Un trabajo que cae por una señal de bloqueo se reencola **sin consumir** `WHATSAPP_MAX_INTENTOS`: la pausa del breaker lo frena y, cuando cierre, se reintenta. Ningún trabajo encolado se pierde.
- Motivo en `/status`: `circuit-breaker`, con la señal detectada y el detalle del error original.

El orden de prioridad al pausar es: circuit breaker → ventana horaria → presupuesto. La configuración de T4b se edita en caliente con `ajustes.actualizar(...)` y se pierde al reiniciar el proceso (S8). El panel la administra por HTTP desde T5 (§4.7).

---

## 4. Endpoints REST

### 4.1 Notificación de Pago Confirmado (RF30)

```
POST /api/notificaciones/whatsapp/pago
```

**Llamado por:** `payments-service` al confirmar un pago de delivery (`WhatsappNotificationClient`). Lee el teléfono y el nombre del cliente desde `GET /ordenes/{id}` de `orders-service` y solo notifica si la orden es `DELIVERY`.

**Header:** `X-Internal-Key: <NOTIFICATION_API_KEY>` (obligatorio solo si la variable está definida).

**Request Body:**
```json
{
  "ordenId": 52,
  "numeroPedido": 3,
  "telefono": "51999888777",
  "nombreCliente": "María García",
  "montoTotal": 68.50,
  "tiempoEstimado": "35-45 min"
}
```

Campos obligatorios según la validación real: `ordenId` (entero positivo), `telefono` y `montoTotal > 0`. `numeroPedido` y `tiempoEstimado` son opcionales. El endpoint **no lee `metodoPago`**: el método de pago no aparece en el mensaje de confirmación.

**Mensaje generado:**
```
Hola, María.

Confirmamos el pago de S/ 68.50 por tu pedido N.° 52. Ya está registrado y pasará a cocina en breve.

Tiempo estimado de entrega: 35-45 min.

Si necesitas ayuda con tu pedido, puedes llamarnos al (056) 123-456.

San Pollo de Ica
```

> Los mensajes usan un tono formal y cercano, sin emojis. Solo se usa el primer nombre del cliente, con mayúscula inicial. Las plantillas están en `src/notifications/messages.js`.

**Response `202 Accepted`:** `{ "status": "EN_COLA", "notificacionId": "notif_98741", "mensaje": "Notificación encolada exitosamente" }`

> Si el teléfono no es normalizable, el registro se crea directamente como `ERROR` y la misma respuesta llega con **`422`** en lugar de `202`.

### 4.2 Notificación de Cambio de Estado (RF31)

```
POST /api/notificaciones/whatsapp/estado
```

**Llamado por:** `orders-service` al cambiar el estado de una orden de delivery (`NotificationService`). Solo envía para `tipo = DELIVERY` y los estados `EN_PREPARACION`, `EN_CAMINO` y `ENTREGADO`; cualquier otro estado responde `400`.

**Header:** `X-Internal-Key: <NOTIFICATION_API_KEY>` (obligatorio solo si la variable está definida).

> ℹ️ `repartidorNombre` y `repartidorTelefono` son opcionales. Hoy `Orden` solo guarda `repartidorId`, así que `orders-service` todavía no los envía y el mensaje `EN_CAMINO` sale sin datos del repartidor.

**Request Body:**
```json
{
  "ordenId": 52,
  "telefono": "51999888777",
  "nombreCliente": "María",
  "estadoNuevo": "EN_CAMINO",
  "repartidorNombre": "Juan Pérez",
  "repartidorTelefono": "987654321"
}
```

**Mensajes según estado:**

Todos empiezan con `Hola, María.` y terminan con la firma `San Pollo de Ica`. El cuerpo según el estado:

| Estado | Cuerpo del mensaje |
| :--- | :--- |
| `EN_PREPARACION` | Tu pedido N.° 52 ya está en preparación. Te avisaremos cuando salga a reparto. |
| `EN_CAMINO` | Tu pedido N.° 52 ya salió a reparto. Te lo lleva Juan Pérez (987 654 321). *(Sin datos del repartidor: "...ya salió a reparto y llegará en los próximos minutos.")* |
| `ENTREGADO` | Tu pedido N.° 52 fue entregado. Gracias por elegirnos. Si tienes un momento, nos ayudaría mucho conocer tu opinión sobre el pedido. |

### 4.3 Historial de Notificaciones (RF32)

```
GET /api/notificaciones/historial
```

**Acceso:** 🔒 Solo `ADMIN` (header `Authorization: Bearer <token de auth-service>`, validado con el mismo `JWT_SECRET`).

**Query Params opcionales:** `?ordenId=52&estado=ENVIADO&desde=2026-10-01`

**Response `200 OK`:**
```json
[
  {
    "id": "notif_98741",
    "ordenId": 52,
    "destinatario": "51999888777",
    "tipo": "PAGO_CONFIRMADO",
    "mensaje": "Hola, María.\n\nConfirmamos el pago de S/ 68.50...",
    "estado": "ENVIADO",
    "intentos": 1,
    "enviadoEn": "2026-10-04T23:45:10Z",
    "creadoEn": "2026-10-04T23:45:00Z"
  }
]
```

---

### 4.3.1 Número de pedido que ve el cliente

Los mensajes **no muestran el ID interno** de la orden. `orders-service` asigna a cada pedido un `numeroCliente` (1, 2, 3...) por cliente con cuenta, o por celular si es invitado, y lo envía como `numeroPedido` en `/pago` y `/estado`. El mensaje dice "tu pedido N.° 3". Si `numeroPedido` no llega, se usa `ordenId`.

### 4.3.2 Código de seguimiento por WhatsApp

```
POST /api/notificaciones/whatsapp/codigo
```

**Llamado por:** `orders-service` cuando un cliente sin sesión quiere ver sus pedidos (`POST /ordenes/seguimiento/codigo`).

```json
{ "telefono": "938924552", "codigo": "4827" }
```

Mensaje enviado:
```
Tu código para ver tus pedidos en San Pollo de Ica es 4827.

Vence en 5 minutos. Si no lo solicitaste, puedes ignorar este mensaje.
```

En el historial se guarda con el código oculto (`****`), sin `ordenId`, con tipo `CODIGO_SEGUIMIENTO`. Si el servicio se reinicia antes de enviarlo, se descarta.

Flujo completo en `orders-service` (rutas públicas):

| Endpoint | Qué hace |
| :--- | :--- |
| `POST /ordenes/seguimiento/codigo` `{ telefono }` | Envía el código solo si ese celular tiene pedidos (responde igual en ambos casos). Máximo 1 cada 60 s. |
| `POST /ordenes/seguimiento/verificar` `{ telefono, codigo }` | 5 intentos, vence a los 5 min. Devuelve un acceso temporal (`token`, 30 min). |
| `GET /ordenes/seguimiento` header `X-Seguimiento-Token` | Pedidos de ese celular. |
| `POST /ordenes/seguimiento/{id}/cancelar` header `X-Seguimiento-Token` | Cancela **solo** el pedido de ese celular (S5). Un pedido ajeno o inexistente responde `404`; token ausente, inválido o vencido → `400`. |

Además, `GET /ordenes/{id}` ahora solo responde al dueño del pedido, al personal o a otro microservicio con `X-Internal-Key` (variable `INTERNAL_API_KEY`, **sin valor por defecto**: si no está definida, la cabecera no autentica y la respuesta es `403`). A cualquier otro le responde 404.

El mismo criterio se aplica a `PATCH /ordenes/{id}/estado`: un `CLIENTE` solo puede cambiar el estado de un pedido **propio**; si intenta tocar el de otro, recibe `404` (no `403`, para no revelar qué pedidos existen). Y el **flujo es obligatorio**: del pedido propio un cliente solo puede pedir `CANCELADO` — intentar `EN_PREPARACION`, `LISTO` o `ENTREGADO` responde `403`, porque el avance por cocina y reparto lo hace el personal.

### 4.4 Vinculación de WhatsApp por QR

```
GET /api/notificaciones/qr
```

**Acceso:** 🔒 Solo `ADMIN`. Devuelve `{ "whatsapp": "waiting_qr", "qr": "data:image/png;base64,..." }`, o `qr: null` si la sesión ya está conectada. Es el endpoint que consume la pestaña **Notificaciones** del panel administrativo (refresco cada 5 s).

Adicionalmente existe una página HTML para escanear el QR desde el navegador:

```
GET /qr
```

Solo responde si la petición viene de `127.0.0.1`/`::1` o si se incluye `?clave=<NOTIFICATION_API_KEY>`; en cualquier otro caso devuelve `403`. Se recarga sola cada 25 s.

### 4.5 Respuestas de error

| Código | Cuándo |
| :--- | :--- |
| `400` | Faltan campos obligatorios, `ordenId` no es entero positivo, `montoTotal` no es mayor que cero, `estadoNuevo` no es un estado de delivery, los filtros de `/historial` son inválidos, o el `PATCH /ajustes` trae un valor inválido (el store queda intacto). |
| `401` | Falta o es incorrecta la `X-Internal-Key` (o el token en `/historial` y `/qr`). |
| `403` | El token de `/historial` o `/qr` no es de un `ADMIN`; la página `GET /qr` se abrió desde fuera del servidor sin `?clave=`. |
| `422` | El teléfono no es normalizable: el envío no entra a la cola, se registra en el historial con estado `ERROR` y la cola no se bloquea. |

### 4.6 Estado del servicio

```
GET /api/notificaciones/status
```

```json
{
  "status": "ok",
  "whatsapp": "connected",
  "colaPendiente": 0,
  "cola": { "enProceso": false, "ultimoEnvioEn": null, "pausada": false, "motivo": null },
  "antiBaneo": {
    "pausada": false,
    "motivo": null,
    "detalle": null,
    "presupuestoHora": { "enviados": 3, "limite": 40 },
    "presupuestoDia": { "enviados": 12, "limite": 500 },
    "ventana": { "horaDesde": 11, "horaHasta": 23, "abierta": true },
    "breaker": { "estado": "cerrado", "senal": null, "detalle": null, "aperturas": 0, "reintentoEn": 0 }
  }
}
```

Valores de `whatsapp`: `starting`, `waiting_qr`, `connected`, `disconnected`, `auth_failure`. Es público (no exige token). `colaPendiente` es el contrato original y no cambia; `cola` es información extra de lo que la cola está haciendo ahora (`enProceso`, el timestamp del último envío y, con el anti-baneo activo, `pausada`/`motivo`). `antiBaneo` es `null` cuando el servicio no tiene gobernador inyectado. `breaker.estado` puede ser `cerrado`, `abierto` o `medioAbierto`; `senal` conserva la última señal de bloqueo detectada para poder auditar por qué se abrió.

### 4.7 Configuración administrable desde el panel (T5, S4/S8/S11)

```
GET   /api/notificaciones/ajustes
PATCH /api/notificaciones/ajustes
```

**Acceso:** 🔒 Solo `ADMIN` (Bearer del token de auth-service). `GET`/`PATCH` sin token → `401`; con un token que no es `ADMIN` → `403`.

**GET** devuelve el store en memoria vigente y el estado del gobernador anti-baneo:

```json
{
  "ajustes": {
    "intervaloMs": 10000, "jitterPct": 20, "typingMinMs": 1000, "typingMaxMs": 6000,
    "typingMsPorCaracter": 50, "presupuestoHora": 40, "presupuestoDia": 500,
    "horaDesde": 11, "horaHasta": 23, "breakerBaseMs": 60000, "breakerMaxMs": 900000,
    "numeroAsesor": "51999888777", "numeroRespaldo": null
  },
  "gobernador": {
    "pausada": false, "motivo": null, "detalle": null,
    "presupuestoHora": { "enviados": 3, "limite": 40 },
    "presupuestoDia": { "enviados": 12, "limite": 500 },
    "ventana": { "horaDesde": 11, "horaHasta": 23, "abierta": true },
    "breaker": { "estado": "cerrado", "senal": null, "detalle": null, "aperturas": 0, "reintentoEn": 0 }
  }
}
```

`gobernador` es el mismo objeto que `/status` publica como `antiBaneo` (y es `null` si el servicio se construyó sin gobernador). Es lo que consume la pantalla del panel para mostrar la pausa, el presupuesto consumido, la ventana horaria y el breaker.

**PATCH** aplica cambios parciales en caliente y devuelve la configuración resultante **completa** (misma forma que `ajustes` en el `GET`):

```json
{ "presupuestoHora": 20, "numeroAsesor": "999 888 777", "numeroRespaldo": "" }
```

- Los campos ausentes conservan su valor vigente; los desconocidos se ignoran.
- Valores inválidos (por ejemplo `jitterPct > 100`, `typingMaxMs < typingMinMs`, una hora fuera de 0-23 o un teléfono con formato incorrecto) responden **`400`** con el motivo y **el store queda intacto**: la validación del store corre antes de aplicar nada.
- `numeroAsesor` (el del admin que conecta WhatsApp desde su panel) y `numeroRespaldo` (opcional, S11/S13) se normalizan a `51 + 9 dígitos` con `src/notifications/phone.js`. El respaldo vacío, `null` o ausente queda en `null`.
- No hay persistencia (S8): todo vive en memoria del proceso y se pierde al reiniciar, que es lo pedido.

---

## 5. Esquema de Datos (Trazabilidad de Envíos)

Tabla `notification_log` en PostgreSQL (se crea sola al arrancar si se define `DATABASE_URL`). Sin `DATABASE_URL`, el historial se guarda en memoria.

> El estado de fallo se llama `ERROR` (RF32 lo menciona como "fallido").

### NotificationLog
| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | `String` | PK, generado (`notif_XXXXX`) |
| `ordenId` | `Number` | Referencia a la orden en `orders-service` |
| `destinatario` | `String` | Número de teléfono con prefijo país (`51XXXXXXXXX`) |
| `tipo` | `String` (Enum) | `PAGO_CONFIRMADO`, `ESTADO_EN_PREPARACION`, `ESTADO_EN_CAMINO`, `ESTADO_ENTREGADO`, `CODIGO_SEGUIMIENTO` |
| `mensaje` | `String` | Texto completo enviado al cliente |
| `estado` | `String` (Enum) | `EN_COLA`, `ENVIADO`, `ERROR` |
| `intentos` | `Number` | Contador de intentos de envío |
| `errorDetalle` | `String` | Mensaje de error si falló (nullable) |
| `enviadoEn` | `DateTime` | Timestamp del envío exitoso (nullable) |
| `creadoEn` | `DateTime` | Timestamp de creación del registro |

---

## 6. Flujo Completo de Notificación (Secuencia)

```
payments-service          orders-service          notification-service       WhatsApp
       │                        │                         │                      │
       ├── Pago APROBADO ───────┤                         │                      │
       │   (delivery)           │                         │                      │
       ├── POST /whatsapp/pago ─┼────────────────────────►│                      │
       │                        │                         ├── Encolar ──────────►│
       │                        │                         │   (Delay 10s)        │
       │                        │                         │◄── Enviado ──────────┤
       │                        │                         │                      │
       │                        ├── PATCH estado ─────────┤                      │
       │                        │   (EN_PREPARACION)      │                      │
       │                        ├── POST /whatsapp/estado─┤                      │
       │                        │                         ├── Encolar ──────────►│
       │                        │                         │   (Delay 10s)        │
       │                        │                         │◄── Enviado ──────────┤
       │                        │                         │                      │
       │                        ├── PATCH estado ─────────┤                      │
       │                        │   (EN_CAMINO)           │                      │
       │                        ├── POST /whatsapp/estado─┤                      │
       │                        │                         ├── Encolar ──────────►│
       │                        │                         │   (Delay 10s)        │
       │                        │                         │◄── Enviado ──────────┤
```

---

## 7. Variables de Entorno

Ver `polleria/notification-service/.env.example`.

```env
# notification-service (:3001)
PORT=3001
NODE_ENV=production                      # Declarado en el Dockerfile; el código no lo lee

# Sesión de WhatsApp
WHATSAPP_SESSION_PATH=./.wwebjs_auth      # Directorio de persistencia de sesión QR (NO subir a git)
WHATSAPP_RATE_LIMIT_MS=10000              # Delay base entre mensajes (default: 10000)
WHATSAPP_MAX_INTENTOS=3                   # Reintentos ante fallos temporales
WHATSAPP_JITTER_PCT=20                    # Variación aleatoria ±% sobre el delay base (default: 20; 0 = delay fijo)
WHATSAPP_TYPING_MIN_MS=1000               # Duración mínima del "escribiendo" (default: 1000)
WHATSAPP_TYPING_MAX_MS=6000               # Duración máxima del "escribiendo" (default: 6000)
WHATSAPP_TYPING_MS_POR_CARACTER=50        # ms de "escribiendo" por carácter, acotado por min/max (default: 50)
WHATSAPP_PRESUPUESTO_HORA=40              # Máximo de mensajes por hora; al agotarse la cola se pausa (default: 40)
WHATSAPP_PRESUPUESTO_DIA=500              # Máximo de mensajes por día; al agotarse la cola se pausa (default: 500)
WHATSAPP_HORA_DESDE=11                    # Inicio de la ventana de envío en hora local, inclusive (default: 11)
WHATSAPP_HORA_HASTA=23                    # Fin de la ventana de envío en hora local, exclusivo (default: 23)
WHATSAPP_BREAKER_BASE_MS=60000            # Backoff base del circuit breaker al detectar bloqueo (default: 60000)
WHATSAPP_BREAKER_MAX_MS=900000            # Tope del backoff exponencial (default: 900000 = 15 min)
WHATSAPP_NUMERO_ASESOR=                   # Celular del admin que conecta WhatsApp; se normaliza a 51+9 dígitos (default: vacío)
WHATSAPP_NUMERO_RESPALDO=                 # Celular de respaldo opcional (S11); vacío = sin respaldo (default: vacío)
PUPPETEER_EXECUTABLE_PATH=                # Opcional: Chrome del servidor (si no hay /usr/bin/google-chrome-stable)

# Historial (RF32)
DATABASE_URL=postgres://postgres:postgres123@localhost:5432/polleria

# Seguridad
JWT_SECRET=<mismo que auth-service>       # Protege GET /historial y GET /qr
NOTIFICATION_API_KEY=<clave compartida>   # Header X-Internal-Key de orders/payments + ?clave= de la página QR
CORS_ALLOWED_ORIGINS=http://localhost:4200

# Datos de contacto incluidos al pie de los mensajes
POLLERIA_TELEFONO=(056) 123-456
```

En `orders-service` y `payments-service`:

```env
NOTIFICATION_URL=http://localhost:3001
NOTIFICATION_API_KEY=<la misma clave>
WHATSAPP_TIEMPO_ESTIMADO=35-45 min        # Solo payments-service
```

---

## 8. Guía de Pruebas para el Equipo

### 8.1 Configuración Inicial
1. Escanear el código QR de WhatsApp Web desde el celular designado para la pollería.
2. La sesión queda persistida en `WHATSAPP_SESSION_PATH` (no requiere re-escaneo en cada reinicio).
3. Verificar conexión: `GET /api/notificaciones/status` → `{ "whatsapp": "connected" }`.
4. ⚠️ La carpeta de sesión equivale a tener el celular iniciado: está en `.gitignore` y nunca debe subirse al repositorio.

### 8.2 Pruebas Funcionales
| Caso | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Pago confirmado | `POST /api/notificaciones/whatsapp/pago` con datos válidos | Mensaje recibido en WhatsApp del destinatario |
| Cambio de estado | `POST /api/notificaciones/whatsapp/estado` con `EN_CAMINO` | Mensaje con datos del repartidor |
| Rate limit | 3 notificaciones simultáneas | Se procesan con 10s de separación |
| Historial | `GET /api/notificaciones/historial?ordenId=52` | Registros con estado `ENVIADO` |
| Número inválido | Teléfono sin formato correcto | Registro con estado `ERROR` (respuesta `422`) y detalle |

### 8.3 Criterios de Aceptación
- [ ] Mensaje de confirmación de pago llega al WhatsApp del cliente.
- [ ] Mensajes de tracking (`EN_PREPARACION`, `EN_CAMINO`, `ENTREGADO`) llegan correctamente.
- [ ] La cola respeta el delay base (± jitter) entre envíos consecutivos.
- [ ] Al agotarse el presupuesto por hora/día la cola se pausa y se reanuda en el período siguiente, sin descartar mensajes.
- [ ] Fuera de la ventana horaria (11 a 23 por defecto) la cola espera y `GET /status` reporta `fuera-de-ventana`.
- [ ] Una señal de rate-overlimit/bloqueo abre el breaker, aplica backoff exponencial acotado y `GET /status` expone la señal detectada; al vencer, un envío de prueba cierra el breaker.
- [ ] Ningún trabajo se pierde durante una pausa (breaker, ventana o presupuesto).
- [ ] Las respuestas del chatbot y las notificaciones salen por la misma cola (sin segundo camino).
- [ ] Ningún mensaje sale sin marcar visto / mostrar "escribiendo" cuando corresponde.
- [ ] El historial registra TODOS los intentos con su estado final.
- [ ] Un número inválido NO bloquea la cola para los siguientes mensajes.
- [ ] `GET /api/notificaciones/ajustes` responde `401` sin token, `403` a un no-ADMIN y `200` a `ADMIN` con los ajustes vigentes y el estado del gobernador.
- [ ] `PATCH /api/notificaciones/ajustes` aplica el cambio en caliente (visible en el `GET` y en `/status`) y devuelve `400` con el store intacto ante un valor inválido.
- [ ] Los números de asesor y de respaldo se guardan normalizados; el respaldo vacío es válido.

---

## 9. Implementación (`polleria/notification-service`)

```
main.js                         # Arranque: store → servicio → API → WhatsApp
main-backup.js                  # Versión previa de arranque, conservada como respaldo (no se ejecuta)
src/config.js                   # Variables de entorno
src/notifications/queue.js      # Cola FIFO con delay y jitter (RNF10), timers/azar inyectables
src/notifications/service.js    # Registra EN_COLA → humaniza → envía → ENVIADO / ERROR, reintentos
src/notifications/store.js      # NotificationLog en PostgreSQL o en memoria (RF32)
src/notifications/messages.js   # Plantillas de mensajes (RF30, RF31)
src/notifications/phone.js      # Normalización de teléfonos peruanos (51 + 9 dígitos)
src/outbound/ajustes.js         # Configuración en memoria (S8): anti-baneo + números de contacto, defaults de entorno
src/outbound/humanizacion.js    # Duración del "escribiendo" proporcional al texto (S2)
src/outbound/breaker.js         # Detección heurística de bloqueo y circuit breaker (T4b)
src/outbound/limites.js         # Presupuesto por hora/día y ventana horaria (T4b)
src/outbound/gobernador.js      # Coordina límites + breaker; la cola lo consulta antes de enviar (T4b)
src/http/app.js                 # Endpoints /api/notificaciones/* y página GET /qr
src/http/auth.js                # JWT ADMIN y X-Internal-Key
src/whatsapp/client.js          # Cliente whatsapp-web.js y reconexión
src/whatsapp/handler.js         # Enrutador de mensajes entrantes hacia el chatbot
src/chatbot/                    # Chatbot de respuestas (menú, conversación, fuera del alcance de RF30-32)
test/                           # Tests con node:test (`npm test`)
Dockerfile                      # Imagen con Chromium para puppeteer
```

**Ejecutar en local:**

```bash
cd polleria/notification-service
cp .env.example .env
npm install
npm start          # escanear el QR la primera vez
npm test
```

**Con Docker:** el servicio está en `docker-compose.local.yml`. La sesión se guarda en el volumen `polleria_local_whatsapp_session`; el QR se ve con `docker logs -f polleria-notification-service`.

Pruebas manuales: `rest-tests/05-fase-3-whatsapp.http`.

