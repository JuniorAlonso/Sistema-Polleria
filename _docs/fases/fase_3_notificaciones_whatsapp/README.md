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
│  │   Cola FIFO Secuencial (p-queue / setTimeout)  │   │
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
| `p-queue` / Buffer | Librería NPM | Cola FIFO con concurrencia 1 y delay de 10s entre envíos |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código | Tipo | Descripción Oficial | Componente Responsable |
| :--- | :---: | :--- | :--- |
| **RF30** | RF | Notificación WhatsApp al cliente al confirmarse el pago de delivery. | `notification-service` |
| **RF31** | RF | Notificaciones WhatsApp automáticas en cada cambio de estado de delivery (`EN_PREPARACION`, `EN_CAMINO`, `ENTREGADO`). | `orders-service` → `notification-service` |
| **RF32** | RF | Registro y auditoría del estado de envío de notificaciones (`EN_COLA`, `ENVIADO`, `FALLIDO`). | `notification-service` |
| **RNF10** | RNF | Rate-limiting de 10 segundos de espera entre mensajes en WhatsApp.js para evitar bloqueos por Meta. | `notification-service` (Queue Worker) |

---

## 3. Arquitectura Anti-Ban (RNF10)

WhatsApp Web bloquea números si detecta ráfagas simultáneas automatizadas. Se implementa una **cola secuencial** con delay estricto:

```
[ Petición A ] ──┐
[ Petición B ] ──┼──► [ Cola FIFO de Envíos ] ──► [ Delay 10s ] ──► Envío WWebJS ──► [ DB Log ]
[ Petición C ] ──┘
```

### 3.1 Base Funcional Existente en Fase 1
En la Fase 1 ya existe un servicio base funcional en `polleria/notification-service/main.js` (puerto `:3001`) con:
- Endpoint básico directo `POST /notificar` (recibe `{ telefono, orderId, estado, nombreCliente }`).
- Endpoint de verificación `GET /status` (estado de conexión de WhatsApp Web).
- Cliente `whatsapp-web.js` con inicialización QR en terminal.

**Alcance a Desarrollar en Fase 3:** Reemplazar los envíos síncronos directos por una cola FIFO con delay estricto de 10s (RNF10), endpoints REST desacoplados por tipo de evento (`/pago`, `/estado`) y persistencia de logs para auditoría de envíos (`/historial`, RF32).

> ✅ **Implementado.** El endpoint `POST /notificar` fue reemplazado por los endpoints de la sección 4. Ver la sección 9 para la estructura del código.

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
  "telefono": "51999888777",
  "nombreCliente": "María García",
  "montoTotal": 68.50,
  "metodoPago": "YAPE_PLIN",
  "tiempoEstimado": "35-45 min"
}
```

**Mensaje generado:**
```
Hola, María.

Confirmamos el pago de S/ 68.50 por tu pedido N.° 52. Ya está registrado y pasará a cocina en breve.

Tiempo estimado de entrega: 35-45 min.

Si necesitas ayuda con tu pedido, puedes llamarnos al (056) 123-456.

San Pollo de Ica
```

> Los mensajes usan un tono formal y cercano, sin emojis. Solo se usa el primer nombre del cliente, con mayúscula inicial. Las plantillas están en `src/notifications/messages.js`.

**Response `202 Accepted`:**
```json
{
  "status": "EN_COLA",
  "notificacionId": "notif_98741",
  "mensaje": "Notificación encolada exitosamente"
}
```

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

Además, `GET /ordenes/{id}` ahora solo responde al dueño del pedido, al personal o a otro microservicio con `X-Internal-Key` (`INTERNAL_API_KEY`, por defecto `polleria-dev-internal-key` en desarrollo). A cualquier otro le responde 404.

### 4.4 Respuestas de error

| Código | Cuándo |
| :--- | :--- |
| `400` | Faltan campos obligatorios o `estadoNuevo` no es un estado de delivery. |
| `401` | Falta o es incorrecta la `X-Internal-Key` (o el token en `/historial`). |
| `403` | El token de `/historial` no es de un `ADMIN`. |
| `422` | El teléfono no tiene formato válido. Igual se registra en el historial con estado `ERROR`. |

### 4.5 Estado del servicio

```
GET /api/notificaciones/status
```

```json
{ "status": "ok", "whatsapp": "connected", "colaPendiente": 0 }
```

Valores de `whatsapp`: `starting`, `waiting_qr`, `connected`, `disconnected`, `auth_failure`.

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
| `tipo` | `String` (Enum) | `PAGO_CONFIRMADO`, `ESTADO_EN_PREPARACION`, `ESTADO_EN_CAMINO`, `ESTADO_ENTREGADO` |
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
NODE_ENV=production

# Sesión de WhatsApp
WHATSAPP_SESSION_PATH=./.wwebjs_auth      # Directorio de persistencia de sesión QR (NO subir a git)
WHATSAPP_RATE_LIMIT_MS=10000              # Delay entre mensajes (default: 10000)
WHATSAPP_MAX_INTENTOS=3                   # Reintentos ante fallos temporales

# Historial (RF32)
DATABASE_URL=postgres://postgres:postgres123@localhost:5432/polleria

# Seguridad
JWT_SECRET=<mismo que auth-service>       # Protege GET /historial
NOTIFICATION_API_KEY=<clave compartida>   # Header X-Internal-Key de orders/payments
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
| Pago confirmado | `POST /whatsapp/pago` con datos válidos | Mensaje recibido en WhatsApp del destinatario |
| Cambio de estado | `POST /whatsapp/estado` con `EN_CAMINO` | Mensaje con datos del repartidor |
| Rate limit | 3 notificaciones simultáneas | Se procesan con 10s de separación |
| Historial | `GET /historial?ordenId=52` | Registros con estado `ENVIADO` |
| Número inválido | Teléfono sin formato correcto | Registro con estado `ERROR` y detalle |

### 8.3 Criterios de Aceptación
- [ ] Mensaje de confirmación de pago llega al WhatsApp del cliente.
- [ ] Mensajes de tracking (`EN_PREPARACION`, `EN_CAMINO`, `ENTREGADO`) llegan correctamente.
- [ ] La cola respeta el delay de 10s entre envíos consecutivos.
- [ ] El historial registra TODOS los intentos con su estado final.
- [ ] Un número inválido NO bloquea la cola para los siguientes mensajes.

---

## 9. Implementación (`polleria/notification-service`)

```
main.js                         # Arranque: store → servicio → API → WhatsApp
src/config.js                   # Variables de entorno
src/notifications/queue.js      # Cola FIFO con delay (RNF10)
src/notifications/service.js    # Registra EN_COLA → envía → ENVIADO / ERROR, reintentos
src/notifications/store.js      # NotificationLog en PostgreSQL o en memoria (RF32)
src/notifications/messages.js   # Plantillas de mensajes (RF30, RF31)
src/notifications/phone.js      # Normalización de teléfonos peruanos (51 + 9 dígitos)
src/http/app.js                 # Endpoints /api/notificaciones/*
src/http/auth.js                # JWT ADMIN y X-Internal-Key
src/whatsapp/client.js          # Cliente whatsapp-web.js y reconexión
src/whatsapp/handler.js         # Chatbot de respuestas (fuera del alcance de RF30-32)
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

