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

### 3.5 Bot de pedidos por WhatsApp I: catálogo real, Ica y estado persistido (T3a, S1/S4/S12)

El motor conversacional vive en `src/chatbot/` y **devuelve el texto**; el handler lo encola en la única cola saliente (§3.3). T3a cubre el primer tramo del pedido anónimo (S1); el carrito y el alta de la orden llegan en T3b.

**Flujo**

1. El menú (`getMainMenu`) conserva sus cuatro opciones. La **1 (Hacer un Pedido)** y cualquier mensaje que pida un pedido inician el flujo.
2. **Primer paso obligatorio (S12):** el bot pregunta si el pedido es de **Ica** (`CONFIRMANDO_ICA`). Si la persona dice que no, informa que el delivery cubre solo Ica, **no avanza con el pedido** y ofrece el número del asesor.
3. Si confirma que sí, el bot muestra la **carta real** leída de `orders-service` (`GET /productos`, público) y deja la conversación en `CATALOGO`. La carta ya no tiene precios escritos a mano.
4. Las opciones 2 (código de pedido), 3 (ubicación/horarios) y 4 (asesor) siguen funcionando.

**Catálogo con cache corto (T3a)**

- `src/pedidos/catalogo.js` lee `GET /productos` con un cache en memoria (`ORDERS_CATALOGO_TTL_MS`, default 30 s) para no golpear el servicio en cada mensaje.
- Si orders-service **falla o no responde** (error de red, timeout o respuesta no-2xx), el bot **no inventa catálogo**: avisa que no puede tomar el pedido en este momento y ofrece el asesor.

**Estado de conversación persistido (T3a)**

- `src/chatbot/conversation.js` reemplaza el `Map` en memoria por un store con la **misma base que el historial** (`DATABASE_URL`, tabla `conversation_state`) y el **mismo fallback en memoria** cuando no hay base. La clave es el celular normalizado del cliente (`src/notifications/phone.js`), así que el estado **sobrevive al reinicio** del servicio con Postgres.
- **Dedup por `message.id`**: si WhatsApp reentrega el mismo mensaje, el bot no vuelve a ejecutar el paso (no responde de nuevo). El registro vive en memoria con vencimiento.

**Número del asesor (S4/S11)**

- El bot usa `numeroAsesor` y, si no hay, `numeroRespaldo` del store de ajustes en memoria (T5, §4.7).
- Si no hay ninguno configurado, **no ofrece un número inexistente**: lo dice tal cual.

### 3.6 Bot de pedidos por WhatsApp II: carrito, resumen y alta del pedido (T3b, S1/S4)

Sobre el motor de T3a, el bot arma el pedido completo y crea la orden anónima. Sigue
**devolviendo el texto** (el handler lo encola, §3.3) y el celular que escribe es la única
identidad (S1).

**Flujo**

1. Tras confirmar que es de Ica, el bot muestra la **carta real numerada** (`GET /productos` de
   orders-service, con cache corto). El cliente responde con el **número** del producto.
   - Agrega la línea; si repite el producto, **suma la cantidad**.
   - `carrito` muestra el resumen; `quitar <número>` quita una línea del resumen.
   - `nota <texto>` guarda una indicación del cliente (`observaciones`) y `mi nombre es <nombre>`
     guarda el nombre (opcional) para el alta.
2. `confirmar` inicia el cierre. Si falta, el bot **pide la dirección de entrega** y luego una
   **referencia**. Sin dirección (que es lo que orders-service exige para `DELIVERY`) **no crea**
   la orden: solo la pide.
3. Con dirección, referencia y carrito, el bot crea el pedido con `POST /ordenes` de
   orders-service (ruta pública, la misma del checkout web):

   ```json
   {
     "tipo": "DELIVERY",
     "canalOrigen": "WHATSAPP",
     "direccionEntrega": "Av. Grau 123, Ica",
     "referencia": "Portón azul frente al parque",
     "telefonoCliente": "51999888777",
     "nombreCliente": "Ana",
     "observaciones": "sin cebolla",
     "items": [{ "productoId": 1, "cantidad": 2 }]
   }
   ```

   `telefonoCliente` es el celular del remitente **normalizado** (`src/notifications/phone.js`).
   `nombreCliente` y `observaciones` solo se mandan si el cliente los dictó.

**Total sin duplicar reglas (S12)**

- El bot **no calcula el envío**. Antes de crear la orden muestra **solo el subtotal** de los ítems y
  aclara que *el costo de envío se suma al confirmar el pedido*.
- El mensaje final usa el **`total`** y el **`numeroCliente`** que devuelve orders-service; el envío
  lo sumó `Orden.recalcularTotal()` del lado del servicio.

**Idempotencia**

- Al crear la orden la conversación pasa al estado final `PEDIDO_CONFIRMADO`, que **recuerda el pedido
  creado**. Un segundo `confirmar` (o la reentrega del mismo `message.id`, que además corta el dedup de
  T3a) responde con el mismo número **sin crear otra orden**.
- El carrito vive en el **estado de conversación persistido** (§3.5), así que sobrevive a un reinicio
  del servicio con `DATABASE_URL`.

**Fallo explícito**

- Si orders-service no responde al crear la orden, el bot lo **dice**, **no inventa número de pedido** y
  **conserva el carrito** en estado `CATALOGO` para reintentar con `confirmar`.
- El mensaje final informa el número de pedido y el total y dice que **el equipo coordina el pago por
  este chat**. La recepción del comprobante de Yape por chat es la tarea siguiente (T6): el bot **no**
  promete ese paso todavía.

### 3.7 Serialización por conversación (T3c, S10/S14)

El handler se invoca por cada evento de mensaje **sin esperar al anterior**. El dedup por `message.id`
de §3.5 corta la reentrega del **mismo** mensaje, pero no dos mensajes distintos del mismo cliente: dos
«confirmar» casi simultáneos podían leer el mismo estado y **abrir dos pedidos**. Lo mismo aplica al
comprobante de Yape (T6), que tampoco se debe registrar dos veces.

`src/chatbot/serializador.js` encadena las tareas de una **misma clave** (el celular normalizado de
`src/notifications/phone.js`) para que se ejecuten **una por una y en orden de llegada**. Un mensaje que
llega mientras el anterior se procesa **espera** (no se descarta ni corre en paralelo) y, al arrancar, ve
el estado que dejó el anterior. El handler envuelve en esa cadena el par **procesar → encolar**, así que
tampoco se pueden invertir las respuestas.

- **Por clave, no global**: una conversación lenta no frena a otro cliente; cada celular tiene su propia
  cadena.
- **Limpieza**: terminada la cadena de una conversación, su entrada se elimina para no acumular clientes
  que no vuelven a escribir. `tamanio` expone cuántas conversaciones hay vivas (observabilidad y tests).
- **Un fallo no traba la conversación**: si una tarea falla, la siguiente de esa clave igual corre.
- **Sin cambios de contrato**: el bot sigue devolviendo el texto y el handler lo encola en la única cola
  saliente (§3.3). El serializador es una instancia por proceso e inyectable en los tests.

### 3.8 Comprobante de Yape: MinIO + `payments-service` (T6b, S6/S7)

Con el pedido ya creado (T3b), el bot queda **esperando el comprobante de Yape**. Cuando llega una
**imagen**, la descarga, la sube a **MinIO** y registra la evidencia en `payments-service`; si lo que llega
no es una imagen, pide una imagen; si falla algo, lo dice y pide reenviar. La aprobación o el rechazo del
comprobante por el `ADMIN` es **T6c** (fuera de este paso).

**Flujo (todo sigue devolviendo texto y saliendo por la cola única, §3.3)**

1. `msg.hasMedia` → el bot descarga con `msg.downloadMedia()` y comprueba que el mimetype sea de imagen.
2. Con pedido confirmado y una imagen válida:
   - sube el archivo a MinIO con la convención de clave
     `comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}` (el bucket se crea si falta);
   - registra la evidencia en `payments-service` con `POST /pagos/comprobante` y `X-Internal-Key`,
     mandando `ordenId`, el celular del remitente (`telefono`) y la `comprobanteClave`; el servicio deja el
     pago en `PENDIENTE_VERIFICACION` (T6a) y es idempotente por orden;
   - responde que el comprobante quedó **recibido** y que un administrador lo va a verificar.
3. **Sin pedido confirmado** en la conversación: el bot **no descarga** ni acepta nada y dice qué falta
   (primero hay que completar el pedido).
4. **No es imagen** (texto o adjunto que no es imagen): no sube ni registra y pide una imagen.
5. **Falla la subida o el registro**: lo dice, **no inventa un éxito** y pide reenviar.

El `ordenId` sale del **estado de conversación persistido** (el pedido creado en T3b); no se guarda ninguna
copia nueva del comprobante. La serialización por conversación (T3c, §3.7) protege este paso de una doble
ejecución, igual que la creación de la orden.

**Módulos nuevos**

- `src/pedidos/almacenamiento.js` (`AlmacenamientoComprobantes`): cliente MinIO oficial con el bucket
  garantizado, clave con la convención acordada y **cliente y reloj inyectables** para los tests.
- `src/pedidos/pagos.js` (`ClientePagos`): `POST /pagos/comprobante` con `X-Internal-Key`; `fetchImpl` y
  timeout inyectables. Si `payments-service` falla, `registrarComprobante()` lanza y el bot avisa.

**Servicio MinIO en el compose (S7)**

`polleria/docker-compose.local.yml` agrega el servicio `minio` (imagen oficial) con la API en
`http://localhost:9000`, la consola en `http://localhost:9001`, el volumen `polleria_local_minio_data` y las
credenciales por variables de entorno (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, defaults de desarrollo
`minioadmin`/`minioadmin`). No cambia ningún servicio existente.

### 3.9 Aviso al cliente cuando se rechaza el comprobante (T6d, S6/S13)

El rechazo del comprobante (T6c, ver §9 de `_docs/fases/fase_1_core_pedidos/04_pagos.md`) deja el pedido
**impago esperando un comprobante válido**: no lo cancela. Si el cliente no se entera, el pedido muere. Al
rechazar, `payments-service` llama a este servicio con `POST /api/notificaciones/whatsapp/comprobante-rechazado`
por medio del **mismo** `WhatsappNotificationClient` que ya usa para el pago aprobado (RF30). El aviso entra por
la **cola única** (T4) y queda registrado en el historial (RF32) con tipo `COMPROBANTE_RECHAZADO`, igual que los
demás.

**Orden garantizado:** el aviso se encola **después de que la transacción del rechazo confirma** (`afterCommit`).
Si la transacción se revirtiera, el aviso no sale; si el notification-service está caído, el rechazo ya quedó
registrado y el pago sigue `RECHAZADO`, y la respuesta al admin no se rompe. El aviso es best-effort: nunca
condiciona la verificación.

### 3.10 Panel: el ADMIN verifica el comprobante de Yape (T6e, S6/S7)

La verificación del comprobante vive en la **pestaña de pedidos** del panel administrativo, como se decidió
en L12, y es **exclusiva del `ADMIN`** (S6): el rol `CAJERO` no se toca y el backend, además, aplica
`@PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN')")` en `POST /pagos/{id}/verificar` (T6c).

**Cuándo aparece**

- Al abrir el **detalle de un pedido**, el panel pide el pago con
  `PaymentService.obtenerPagoParaVerificacion(ordenId)` → `GET /pagos/orden/{ordenId}`.
- Solo se muestra el bloque si el pago llegó en `PENDIENTE_VERIFICACION` **y** el backend devolvió
  `comprobanteUrl`. Un pedido sin comprobante pendiente (pago `APROBADO`, `RECHAZADO`, `CANCELADO`, otro
  método de pago o directamente sin pago) no agrega nada a la pantalla: el `404` de una orden sin pago se
  trata como “no hay nada que verificar”.
- El bloque solo se renderiza para `ADMIN`; cualquier otro rol ve el detalle como antes.

**La URL del comprobante no se cachea**

- `comprobanteUrl` es una **URL firmada de MinIO de vida corta (300 s)** que solo recibe el `ADMIN`.
- Se pide **al abrir el detalle** y se descarta al cerrarlo o al cambiar de pedido: guardarla y reusarla
  mostraría una imagen rota. Por eso el estado del comprobante se reinicia en cada apertura.

**Aprobar o rechazar**

- **Aprobar** manda `{ aprobado: true }` y el backend avanza la orden con el mismo mecanismo del pago
  aprobado de Mercado Pago (T6c); el cliente recibe su aviso por WhatsApp.
- **Rechazar** exige un **motivo escrito**: sin motivo el botón queda **deshabilitado** y la pantalla dice
  por qué. La validación es doble: el panel no llama al backend sin motivo
  (`PaymentService.verificarComprobante` devuelve el error localmente) y el backend también respondería `400`
  porque `motivoRechazo` es obligatorio (T6c).
- El resultado **solo** refleja lo que responde el backend: se actualiza el estado del pago con la respuesta
  de `POST /pagos/{id}/verificar` (nada de optimismo local). El backend **no devuelve el estado del pedido**
  en ese contrato, así que la pantalla no lo inventa; la lista de pedidos se actualiza con el **sondeo** que
  el panel ya hace.
- Si el backend responde un error (por ejemplo `409` porque otro admin ya lo verificó), se muestra **su
  mensaje tal cual** y no se marca ningún éxito.

**Métodos y contrato del frontend**

- `PaymentService.obtenerPagoParaVerificacion(ordenId)` (`GET /pagos/orden/{ordenId}`) y
  `PaymentService.verificarComprobante(pagoId, aprobado, motivoRechazo?)` (`POST /pagos/{id}/verificar`),
  agregados a `frontEnd/src/app/core/services/payment.service.ts`.
- Los tipos `EstadoPagoAdmin` y `PagoOrdenAdmin` viven en el servicio: `PENDIENTE_VERIFICACION` no existe en
  el `PaymentStatus` del modelo compartido y `comprobanteUrl` no se mapea en el adaptador actual, así que la
  pantalla de verificación —exclusiva del `ADMIN`— usa su propio contrato en vez de tocar el modelo general.

**Pruebas**: `frontEnd/src/app/core/services/payment.service.spec.ts` cubre la ruta de consulta y la URL del
comprobante, `{ aprobado: true }`, el rechazo con motivo con el mensaje de error del backend propagado sin
reportar éxito, y que **sin motivo no se dispara ninguna llamada**.

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

### 4.3.3 Aviso de comprobante rechazado (T6d, S6/S13)

```
POST /api/notificaciones/whatsapp/comprobante-rechazado
```

**Llamado por:** `payments-service` al rechazar un comprobante de Yape (`WhatsappNotificationClient`), con el
mismo cliente HTTP del pago aprobado (RF30). Lee el teléfono, el nombre y el número de pedido desde
`GET /ordenes/{id}` de orders-service y solo avisa si la orden es `DELIVERY`.

**Header:** `X-Internal-Key: <NOTIFICATION_API_KEY>`.

**Request Body:**
```json
{
  "ordenId": 52,
  "numeroPedido": 3,
  "telefono": "51999888777",
  "nombreCliente": "María García",
  "motivo": "El monto no coincide con el total del pedido"
}
```

Campos obligatorios: `ordenId` (entero positivo), `telefono` y `motivo` (no puede venir vacío). Si falta
alguno responde `400` y no encola nada.

**Mensaje generado:**
```
Hola, María.

No pudimos validar el comprobante de Yape de tu pedido N.° 3.
Motivo: El monto no coincide con el total del pedido

Puedes enviar un comprobante nuevo por este mismo chat para completar el pago.

San Pollo de Ica
```

Usa el **número de pedido que ve el cliente** (`numeroPedido`), nunca el id interno, e incluye el motivo que
dio el administrador. Se guarda en el historial con tipo `COMPROBANTE_RECHAZADO`, manteniendo el tono formal
sin emojis del servicio.

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

### 4.8 Pantalla del panel: «Anti-baneo y contactos» (T5b)

La pestaña **Notificaciones** del panel administrativo consume estos endpoints a través de
`WhatsappNotificationsService.obtenerAjustes()` / `actualizarAjustes(cambios)` (el token ADMIN lo agrega
`authTokenInterceptor`, igual que en el resto del panel):

- Carga `GET /api/notificaciones/ajustes` al abrir la pestaña y muestra los valores vigentes junto con el
  estado del gobernador: si está pausado y por qué, el presupuesto consumido de hora y de día, si la ventana
  horaria está abierta y el estado del breaker (hoy invisible desde la UI).
- El formulario permite editar todos los campos numéricos y los dos teléfonos. El `PATCH` manda **solo los
  campos que cambiaron** y refresca lo que devuelve el backend.
- El respaldo es opcional: dejarlo vacío lo guarda como `null` sin tocar al asesor.
- Un rechazo del backend se muestra **tal cual** (el mensaje de `{ error }`); la pantalla no inventa valores
  ni simula un guardado exitoso.
- La propia pantalla advierte con un aviso visible que los ajustes viven **en memoria** y se pierden al
  reiniciar el servicio (S8), para que nadie los crea persistentes.

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
WHATSAPP_NUMERO_YAPE=                     # Yape de la pollería que el bot le indica al cliente (T6f; default: +51 934 421 442)
PUPPETEER_EXECUTABLE_PATH=                # Opcional: Chrome del servidor (si no hay /usr/bin/google-chrome-stable)

# Catálogo real del bot de pedidos (T3a)
ORDERS_SERVICE_URL=http://localhost:8082  # Base de orders-service para GET /productos y POST /ordenes (default: http://localhost:8082)
ORDERS_CATALOGO_TTL_MS=30000              # Cache en memoria del catálogo (default: 30000 ms)
# T3b (carrito y alta del pedido) REUTILIZA ORDERS_SERVICE_URL para POST /ordenes: no agrega variables nuevas.

# Comprobante de Yape por WhatsApp (T6b, S6/S7)
PAYMENTS_SERVICE_URL=http://localhost:8083  # Base de payments-service para POST /pagos/comprobante (default: http://localhost:8083)
INTERNAL_API_KEY=<clave interna compartida>  # X-Internal-Key para /pagos/comprobante; debe coincidir con la de payments-service. Sin ella, el registro responde 401 y el bot avisa el fallo
MINIO_ENDPOINT=localhost                   # Host de MinIO (default: localhost; en Docker, `minio`)
MINIO_PORT=9000                            # Puerto de la API S3 (default: 9000)
MINIO_USE_SSL=false                        # true para MinIO con TLS (default: false)
MINIO_ACCESS_KEY=minioadmin                # Access key de MinIO (default de desarrollo: minioadmin; debe coincidir con MINIO_ROOT_USER)
MINIO_SECRET_KEY=minioadmin                # Secret key de MinIO (default de desarrollo: minioadmin; debe coincidir con MINIO_ROOT_PASSWORD)
MINIO_BUCKET=polleria-comprobantes         # Bucket de los comprobantes; se crea si falta (default: polleria-comprobantes)

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
| Comprobante rechazado | `POST /api/notificaciones/whatsapp/comprobante-rechazado` con `{ ordenId, telefono, motivo }` | Mensaje con el número de pedido y el motivo; registro `COMPROBANTE_RECHAZADO` en el historial |

### 8.3 Criterios de Aceptación
- [ ] Mensaje de confirmación de pago llega al WhatsApp del cliente.
- [ ] Mensajes de tracking (`EN_PREPARACION`, `EN_CAMINO`, `ENTREGADO`) llegan correctamente.
- [ ] La cola respeta el delay base (± jitter) entre envíos consecutivos.
- [ ] Al agotarse el presupuesto por hora/día la cola se pausa y se reanuda en el período siguiente, sin descartar mensajes.
- [ ] Fuera de la ventana horaria (11 a 23 por defecto) la cola espera y `GET /status` reporta `fuera-de-ventana`.
- [ ] Una señal de rate-overlimit/bloqueo abre el breaker, aplica backoff exponencial acotado y `GET /status` expone la señal detectada; al vencer, un envío de prueba cierra el breaker.
- [ ] Ningún trabajo se pierde durante una pausa (breaker, ventana o presupuesto).
- [ ] Las respuestas del chatbot y las notificaciones salen por la misma cola (sin segundo camino).
- [ ] El bot pide confirmar que el pedido es de Ica antes de continuar; si la persona no es de Ica, no toma el pedido y ofrece el asesor.
- [ ] La carta que muestra el bot sale de `GET /productos` de orders-service (con cache corto) y, si el servicio no responde, no se inventa catálogo.
- [ ] El estado de conversación sobrevive al reinicio del servicio (con `DATABASE_URL`) y funciona con el fallback en memoria cuando no hay base.
- [ ] Un mensaje reentregado con el mismo `message.id` no ejecuta dos veces el mismo paso.
- [ ] El bot ofrece `numeroAsesor` o, si no hay, `numeroRespaldo`; sin ninguno, lo dice sin inventar un número.
- [ ] El bot arma el carrito por el número de la carta, suma la cantidad al repetir, permite quitar
  y conserva el carrito entre mensajes (y tras un reinicio, con `DATABASE_URL`).
- [ ] Antes de crear la orden el bot pide dirección y referencia; sin dirección no crea nada.
- [ ] `confirmar` crea **una** orden `DELIVERY` con `canalOrigen: WHATSAPP`, el celular del remitente y los
  ítems del carrito, y el mensaje final trae el **número y el total devueltos por orders-service**.
- [ ] El resumen previo muestra solo el subtotal y aclara que el envío se suma al confirmar.
- [ ] Confirmar dos veces (o la reentrega del mismo `message.id`) crea una sola orden.
- [ ] Si orders-service falla al crear la orden, el bot lo dice, no hay número de pedido y el carrito
  sigue disponible para reintentar.
- [ ] Ningún mensaje sale sin marcar visto / mostrar "escribiendo" cuando corresponde.
- [ ] El historial registra TODOS los intentos con su estado final.
- [ ] Un número inválido NO bloquea la cola para los siguientes mensajes.
- [ ] `GET /api/notificaciones/ajustes` responde `401` sin token, `403` a un no-ADMIN y `200` a `ADMIN` con los ajustes vigentes y el estado del gobernador.
- [ ] `PATCH /api/notificaciones/ajustes` aplica el cambio en caliente (visible en el `GET` y en `/status`) y devuelve `400` con el store intacto ante un valor inválido.
- [ ] Los números de asesor y de respaldo se guardan normalizados; el respaldo vacío es válido.
- [ ] La pestaña Notificaciones del panel carga y edita los ajustes, muestra el estado del gobernador y advierte
  que viven en memoria (S8).
- [ ] Al llegar una **imagen** con un pedido confirmado, el bot la sube a MinIO con la clave
  `comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}` y registra la evidencia en `payments-service`
  (`POST /pagos/comprobante` con `X-Internal-Key`), dejando el pago en `PENDIENTE_VERIFICACION`.
- [ ] Sin pedido confirmado el bot **no** acepta el comprobante y dice qué falta; si lo que llega no es una
  imagen, pide una imagen sin subir ni registrar nada.
- [ ] Si falla la subida a MinIO o el registro en `payments-service`, el bot lo dice y pide reenviar: nunca
  reporta un éxito que no ocurrió.
- [ ] El bucket de MinIO se crea solo si falta y el servicio `minio` del compose expone API (9000) y consola (9001).
- [ ] Al rechazar el comprobante, el cliente recibe por WhatsApp el número de pedido y el motivo, y el aviso
  sale recién cuando el rechazo ya quedó guardado: si el notification-service falla, el pago igual queda
  `RECHAZADO` y la respuesta al admin no se rompe.
- [ ] La pestaña de pedidos del panel, **solo para `ADMIN`**, muestra el comprobante pendiente al abrir el
  detalle con la imagen pedida en ese momento (sin cachear la URL de 300 s), exige motivo para rechazar
  (botón deshabilitado y explicado) y refleja únicamente el estado que responde el backend, mostrando su
  mensaje de error tal cual cuando falla.

---

## 9. Implementación (`polleria/notification-service`)

```
main.js                         # Arranque: store → servicio → API → WhatsApp
main-backup.js                  # Versión previa de arranque, conservada como respaldo (no se ejecuta)
src/config.js                   # Variables de entorno
src/notifications/queue.js      # Cola FIFO con delay y jitter (RNF10), timers/azar inyectables
src/notifications/service.js    # Registra EN_COLA → humaniza → envía → ENVIADO / ERROR, reintentos
src/notifications/store.js      # NotificationLog en PostgreSQL o en memoria (RF32)
src/notifications/messages.js   # Plantillas de mensajes (RF30, RF31, T6d)
src/notifications/phone.js      # Normalización de teléfonos peruanos (51 + 9 dígitos)
src/outbound/ajustes.js         # Configuración en memoria (S8): anti-baneo + números de contacto, defaults de entorno
src/outbound/humanizacion.js    # Duración del "escribiendo" proporcional al texto (S2)
src/outbound/breaker.js         # Detección heurística de bloqueo y circuit breaker (T4b)
src/outbound/limites.js         # Presupuesto por hora/día y ventana horaria (T4b)
src/outbound/gobernador.js      # Coordina límites + breaker; la cola lo consulta antes de enviar (T4b)
src/http/app.js                 # Endpoints /api/notificaciones/* y página GET /qr
src/http/auth.js                # JWT ADMIN y X-Internal-Key
src/pedidos/catalogo.js         # Catálogo real de orders-service con cache corto y fallo explícito (T3a)
src/pedidos/ordenes.js          # Alta del DELIVERY anónimo en orders-service (POST /ordenes) y total devuelto (T3b)
src/pedidos/almacenamiento.js   # Subida del comprobante a MinIO: bucket, clave y cliente inyectables (T6b)
src/pedidos/pagos.js            # Registro del comprobante en payments-service con X-Internal-Key (T6b)
src/whatsapp/client.js          # Cliente whatsapp-web.js y reconexión
src/whatsapp/handler.js         # Enrutador de mensajes entrantes: encola la respuesta del bot (T3a); serializa por conversación (T3c)
src/chatbot/chatbot.js          # Motor conversacional: menú, Ica, catálogo, carrito, alta, estado y dedup (T3a/T3b)
src/chatbot/conversation.js     # Estado de conversación persistido (misma base que el historial + fallback en memoria)
src/chatbot/menu.js             # Textos y formato de la carta real (sin precios hardcodeados)
src/chatbot/dedup.js            # Dedup de mensajes entrantes por message.id
src/chatbot/serializador.js     # Serialización por conversación (T3c): un mensaje por vez y en orden de llegada
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

