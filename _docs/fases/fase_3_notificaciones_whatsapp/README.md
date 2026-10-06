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

### 3.2 Implementación Técnica de la Cola Anti-Ban
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

**Llamado por:** `payments-service` al confirmar un pago de delivery.

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
🍗 ¡Hola María! Tu pago de S/ 68.50 por el pedido #52 ha sido confirmado.

📦 Tiempo estimado de entrega: 35-45 min.
📞 ¿Problemas? Llámanos al (056) 123-456.

— San Pollo de Ica 🐔
```

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

**Llamado por:** `orders-service` al cambiar el estado de una orden de delivery.

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

| Estado | Mensaje |
| :--- | :--- |
| `EN_PREPARACION` | `🔥 ¡María! Tu pedido #52 está siendo preparado por nuestro chef. ¡Ya falta poco!` |
| `EN_CAMINO` | `🛵 ¡Tu pedido #52 ya va en camino! Repartidor: Juan Pérez (987654321)` |
| `ENTREGADO` | `✅ ¡Pedido #52 entregado! Gracias por preferir San Pollo. ¿Te gustó? ¡Déjanos tu opinión!` |

### 4.3 Historial de Notificaciones (RF32)

```
GET /api/notificaciones/historial
```

**Acceso:** 🔒 Solo `ADMIN`

**Query Params opcionales:** `?ordenId=52&estado=ENVIADO&desde=2026-10-01`

**Response `200 OK`:**
```json
[
  {
    "id": "notif_98741",
    "ordenId": 52,
    "destinatario": "51999888777",
    "tipo": "PAGO_CONFIRMADO",
    "mensaje": "🍗 ¡Hola María! Tu pago de S/ 68.50...",
    "estado": "ENVIADO",
    "intentos": 1,
    "enviadoEn": "2026-10-04T23:45:10Z",
    "creadoEn": "2026-10-04T23:45:00Z"
  }
]
```

---

## 5. Esquema de Datos (Trazabilidad de Envíos)

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

```env
# notification-service (:3001)
PORT=3001
NODE_ENV=production

# Sesión de WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-session  # Directorio de persistencia de sesión QR
WHATSAPP_RATE_LIMIT_MS=10000              # Delay entre mensajes (default: 10000)

# Comunicación inter-servicio (opcional si se llama desde otros servicios)
ORDERS_SERVICE_URL=http://localhost:8082
PAYMENTS_SERVICE_URL=http://localhost:8083
```

---

## 8. Guía de Pruebas para el Equipo

### 8.1 Configuración Inicial
1. Escanear el código QR de WhatsApp Web desde el celular designado para la pollería.
2. La sesión queda persistida en `WHATSAPP_SESSION_PATH` (no requiere re-escaneo en cada reinicio).
3. Verificar conexión: `GET /api/notificaciones/status` → `{ "whatsapp": "connected" }`.

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
