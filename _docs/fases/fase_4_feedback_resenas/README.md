# ⭐ FASE 4 — Feedback, Reseñas y Gestión de Reclamos (`feedback-service`)

**Objetivo:** Habilitar el canal de satisfacción del cliente: calificaciones con estrellas, reseñas de pedidos, reporte de incidencias con evidencia fotográfica y emisión de reembolsos asociados.

**Prioridad:** Media-Baja — Retención de clientes y mejora continua del servicio.

> ⚠️ **Fase Independiente:** Esta fase es autocontenida y puede desarrollarse, probarse y desplegarse de forma independiente por un miembro del equipo sin depender de las demás fases en progreso.

---

## 1. Arquitectura del Módulo de Feedback

```
┌──────────────────────┐        ┌──────────────────────┐
│ Frontend (Angular)   │        │ payments-service     │
│ :4200                │        │ :8083                │
│                      │        │                      │
│ - Modal Calificación │        │ - Reembolsos API     │
│ - Formulario Reclamo │        │                      │
│ - Panel Admin Quejas │        │                      │
└──────────┬───────────┘        └──────────▲───────────┘
           │ REST                           │ POST /pagos/{id}/reembolso
           ▼                                │
┌──────────────────────────────────────────────────────┐
│              feedback-service (:8085)                 │
│                                                       │
│  ┌─────────────────┐    ┌──────────────────────────┐  │
│  │ Módulo Reseñas   │    │ Módulo Reclamos          │  │
│  │ (1-5 estrellas)  │    │ (Tickets + Evidencia)    │  │
│  └─────────────────┘    └──────────────────────────┘  │
│                                                       │
└───────────────────────────┬───────────────────────────┘
                            ▼
              PostgreSQL (`polleria`, base única local)
              + almacenamiento local de evidencias
              (`./uploads/evidencias`)
```

| Componente           |                                  Tecnología                                   | Rol                                                                                                                        |
| :------------------- | :---------------------------------------------------------------------------: | :------------------------------------------------------------------------------------------------------------------------- |
| `feedback-service`   |                          Spring Boot 3.4.5 (Java 21)                          | Módulo de calificaciones, reclamos y reembolsos                                                                            |
| PostgreSQL           |                Base `polleria` (Docker) / base dedicada en RDS                | Tablas `resenias` y `reportes_incidencia`                                                                                  |
| `FileStorageService` | Sistema de archivos local (`storage.upload-dir`, def. `./uploads/evidencias`) | Guarda las fotos y las publica en `GET /feedback/evidencias/{fileName}`. **No hay integración con S3 ni con GCP Storage.** |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código   | Tipo | Descripción Oficial                                                                                                     | Componente Responsable                                           |
| :------- | :--: | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **RF26** |  RF  | Los clientes califican (1 a 5 estrellas) y dejan reseñas de sus pedidos completados.                                    | `feedback-service`                                               |
| **RF27** |  RF  | Los clientes reportan problemas de un pedido adjuntando descripción y evidencia fotográfica.                            | `feedback-service` + `FileStorageService` (almacenamiento local) |
| **RF28** |  RF  | El administrador visualiza, responde y gestiona el estado de reseñas y reportes (`ABIERTO`, `EN_REVISION`, `RESUELTO`). | `feedback-service` + Frontend Admin                              |
| **RF29** |  RF  | El administrador emite reembolsos asociados a reportes procedentes.                                                     | `feedback-service` → `payments-service`                          |

---

## 3. Entidades del Dominio

### 3.1 Reseña (`Resenia`)

```java
@Entity
@Table(name = "resenias")
public class Resenia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ordenId;       // Referencia foránea lógica a orders-service

    @Column(nullable = false)
    private Long clienteId;     // ID del usuario que califica

    @Min(1) @Max(5)
    @Column(nullable = false)
    private Integer calificacion; // 1 a 5 estrellas

    @Column(length = 1000)
    private String comentario;

    private LocalDateTime creadoEn = LocalDateTime.now();
}
```

### 3.2 Reporte de Incidencia (`ReporteIncidencia`)

```java
@Entity
@Table(name = "reportes_incidencia")
public class ReporteIncidencia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ordenId;

    @Column(nullable = false)
    private Long clienteId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MotivoReclamo motivo; // PEDIDO_INCOMPLETO, DEMORA_EXCESIVA, COMIDA_FRIA, OTRO

    @Column(length = 2000, nullable = false)
    private String descripcion;

    private String fotoEvidenciaUrl; // Ruta relativa servida por /feedback/evidencias/{fileName}

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoReclamo estado = EstadoReclamo.ABIERTO;

    private String respuestaAdmin;
    private Boolean reembolsoProcedente = false;
    private BigDecimal montoReembolso;
    private LocalDateTime creadoEn = LocalDateTime.now();
    private LocalDateTime resueltoEn;
}
```

### 3.3 Enumeraciones

```java
public enum MotivoReclamo {
    PEDIDO_INCOMPLETO,
    DEMORA_EXCESIVA,
    COMIDA_FRIA,
    PRODUCTO_DANADO,
    OTRO
}

public enum EstadoReclamo {
    ABIERTO,       // Recién creado por el cliente
    EN_REVISION,   // Admin revisando el caso
    RESUELTO,      // Cerrado con o sin reembolso
    RECHAZADO      // Reclamo no procede
}
```

---

## 4. Endpoints REST

### 4.1 Reseñas (Cliente)

#### Crear Reseña (RF26)

```
POST /feedback/resenias
```

**Acceso:** 🔒 Autoridades `CLIENTE` o `ADMIN`.

**Request Body:**

```json
{
  "ordenId": 52,
  "calificacion": 5,
  "comentario": "Pollo jugoso, papas crocantes y llegó caliente. ¡Excelente!"
}
```

**Validaciones reales:**

- `ordenId` y `calificacion` son obligatorios; `calificacion` es un entero entre 1 y 5 (`@Min(1)`/`@Max(5)`). Un valor fuera de rango responde `400` con el detalle de la validación.
- El cliente solo puede dejar UNA reseña por orden: el segundo intento lanza `IllegalStateException` y responde `409 CONFLICT`.
- **Validación con `orders-service`**: el servicio consulta `orders-service` (`GET /ordenes/{id}`) usando `X-Internal-Key` para certificar que la orden existe, que pertenece al `clienteId` autenticado y que se encuentra en estado `ENTREGADO`. De no cumplirse, responde `404 Not Found` o `409 Conflict`.
- `clienteId` no viaja en el body: se extrae de las credenciales del token (`Principal`).

**Response `201 Created`:**

```json
{
  "id": 15,
  "ordenId": 52,
  "clienteId": 7,
  "calificacion": 5,
  "comentario": "Pollo jugoso, papas crocantes y llegó caliente. ¡Excelente!",
  "respuestaAdmin": null,
  "respondidoEn": null,
  "visible": true,
  "creadoEn": "2026-10-05T10:30:00"
}
```

#### Responder Reseña (Admin - RF28)

```
PATCH /feedback/resenias/admin/{id}/responder
```

**Acceso:** 🔒 Solo `ADMIN`

**Request Body:**

```json
{
  "respuestaAdmin": "Muchas gracias por tu reseña. Nos alegra que disfrutaras nuestro pollo a la brasa."
}
```

#### Moderar Visibilidad de Reseña (Admin - RF28)

```
PATCH /feedback/resenias/admin/{id}/visibilidad?visible=false
```

**Acceso:** 🔒 Solo `ADMIN`

#### Obtener Reseñas por Producto (Público)

```
GET /feedback/resenias/producto/{productoId}
```

**Acceso:** 🔓 Público

**Response `200 OK`:**

```json
{
  "productoId": 3,
  "promedioCalificacion": 4.6,
  "totalResenias": 23,
  "resenias": [
    {
      "calificacion": 5,
      "comentario": "El mejor pollo de Ica",
      "creadoEn": "2026-10-05T10:30:00"
    }
  ]
}
```

### 4.2 Reclamos (Cliente)

#### Crear Reclamo con Evidencia (RF27)

Existen **dos** endpoints, según si la evidencia viaja o no:

```
POST /feedback/reportes            # JSON, sin archivo
POST /feedback/reportes/multipart  # multipart/form-data, con archivo
```

**Acceso:** 🔒 Autoridades `CLIENTE` o `ADMIN`.

**Campos del formulario (`/reportes/multipart`):**
| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `ordenId` | `number` | ✅ | Entero; no se valida contra `orders-service` |
| `motivo` | `string` | ✅ | Enum `MotivoReclamo` |
| `descripcion` | `string` | ✅ | Entre 10 y 2000 caracteres (`@Size(min = 10, max = 2000)`) |
| `foto` | `file` | ❌ | JPEG/PNG, máximo 5 MB (`spring.servlet.multipart.max-file-size`) |

> ⚠️ El nombre del campo del archivo es **`foto`**, no `evidencia`. Y `POST /feedback/reportes` recibe JSON (`ordenId`, `motivo`, `descripcion`, `fotoEvidenciaUrl`), no `multipart/form-data`.

**Response `201 Created`:**

```json
{
  "id": 8,
  "ordenId": 52,
  "motivo": "PEDIDO_INCOMPLETO",
  "descripcion": "Me faltó la porción de tequeños que pedí en el combo...",
  "fotoEvidenciaUrl": "/feedback/evidencias/8-a1b2c3.jpg",
  "estado": "ABIERTO",
  "creadoEn": "2026-10-05T11:00:00"
}
```

#### Consultar Estado de Reclamo por Orden (Público - Seguimiento de Pedidos)

```
GET /feedback/reportes/orden/{ordenId}
```

**Acceso:** 🔓 Público (`permitAll()`)

Permite a la pantalla de seguimiento del cliente (`order-tracking`) sincronizar en tiempo real el estado (`ABIERTO`, `EN_REVISION`, `RESUELTO`, `RECHAZADO`), la respuesta oficial de la administración y el monto de reembolso aprobado, sin requerir sesión activa ni depender únicamente del `localStorage`.

**Response `200 OK`:**

```json
{
  "id": 8,
  "ordenId": 4,
  "clienteId": 1,
  "motivo": "PEDIDO_INCOMPLETO",
  "descripcion": "Me faltaron las cremas y la porción de tequeños.",
  "fotoEvidenciaUrl": "/feedback/evidencias/uuid-evidencia.jpg",
  "estado": "RESUELTO",
  "respuestaAdmin": "Se verificó la orden y se emitió el reembolso correspondiente.",
  "resolucion": "Se verificó la orden y se emitió el reembolso correspondiente.",
  "reembolsoProcedente": true,
  "montoReembolso": 15.00,
  "creadoEn": "2026-10-18T20:30:00",
  "resueltoEn": "2026-10-18T21:05:00"
}
```

---

### 4.3 Gestión de Reclamos (Admin)

#### Dashboard de Reclamos (RF28)

```
GET /feedback/admin/reportes
```

**Acceso:** 🔒 Solo `ADMIN`

**Query Params opcionales:** `?estado=ABIERTO&motivo=PEDIDO_INCOMPLETO` (ambos combinables). **No existe filtro por fecha.**

**Response `200 OK`:** `ReporteResponse[]` completo, ordenado por `creadoEn` descendente.

#### Cambiar Estado de Reclamo (Admin - RF28)

```
PATCH /feedback/admin/reportes/{id}/estado?estado=EN_REVISION
```

**Acceso:** 🔒 Solo `ADMIN`

Permite mover reclamos entre `ABIERTO` y `EN_REVISION` sin alterar reembolsos ni fijar prematuramente la fecha de resolución.

#### Resolver Reclamo (RF28, RF29)

```
PATCH /feedback/admin/reportes/{id}/resolver
```

**Acceso:** 🔒 Solo `ADMIN`

**Request Body:**

```json
{
  "estado": "RESUELTO",
  "respuestaAdmin": "Disculpas por el inconveniente. Se procede con reembolso parcial.",
  "reembolsoProcedente": true,
  "montoReembolso": 15.0
}
```

**Acciones automáticas si `reembolsoProcedente = true`:**

1. Llama a `payments-service` → `POST /pagos/orden/{ordenId}/reembolso` con `{ monto, motivo }` y reenvía el `Bearer` del administrador (`PaymentsClient`). La ruta se resuelve **por `ordenId`**, no por `pagoId`. Si la pasarela o el servicio de pagos falla, se aborta la transacción y se responde error para proteger la integridad.
2. Actualiza el estado del reporte al valor recibido (`RESUELTO` o `RECHAZADO`), almacena la `respuestaAdmin` y registra la marca de tiempo en `resueltoEn`.

---

## 5. Flujo de Emisión de Reembolsos (RF29)

```
Admin (Dashboard)         feedback-service          payments-service       Cliente (Seguimiento)
       │                         │                         │                        │
       ├── 1. Aprueba reclamo ──►│                         │                        │
       │   (monto = S/ 15.00)   │                         │                        │
       │                         ├── 2. POST /pagos/orden/{ordenId}/reembolso ►│    │
       │                         │      (monto, motivo, Bearer)   │                 │
       │                         │                         ├── 3. Reversa           │
       │                         │                         │   (Pasarela/Manual)    │
       │                         │◄── 4. Reembolso OK ─────┤                        │
       │                         │    (transaccionId)      │                        │
       │◄── 5. Ticket RESUELTO ──┤                                                  │
                                 │                                                  │
                                 │◄── 6. GET /feedback/reportes/orden/{id} ─────────┤
                                 ├──── 7. Status RESUELTO + Detalle + Reembolso ───►│
```

---

## 6. Variables de Entorno

```properties
# feedback-service (:8085) — valores reales de application.properties
server.port=${PORT:8085}
DB_URL=jdbc:postgresql://localhost:5432/polleria     # def. local; en Docker apunta al contenedor postgres
DB_USERNAME=postgres
DB_PASSWORD=postgres123                              # valor por defecto del repo
JWT_SECRET=<clave-secreta-compartida-min-256-bits>   # sin valor por defecto: el servicio no arranca si falta
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:80,http://localhost

# Comunicación inter-servicio (solo payments se usa hoy, para reembolsos)
ORDERS_SERVICE_URL=http://localhost:8082             # declarada; hoy ningún servicio la consume
PAYMENTS_SERVICE_URL=http://localhost:8083           # PaymentsClient

# Almacenamiento de evidencias (sistema de archivos local)
UPLOAD_DIR=./uploads/evidencias
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=10MB
```

> No existen `STORAGE_TYPE`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` ni `UPLOAD_MAX_SIZE_MB` en el servicio.

---

## 7. Entregables e Integración Frontend (Angular 19)

1. **Modal y Sección de Calificación Post-Entrega (`order-tracking`):**
   - Habilitado cuando la orden se encuentra completada/entregada.
   - Selector interactivo de 1 a 5 estrellas con validación de comentario obligatorio (mínimo 10 caracteres).
   - Bloqueo de duplicados por orden y persistencia local + remota.

2. **Formulario de Reclamo y Evidencias (`order-tracking`):**
   - Formulario con selector de motivo (`PEDIDO_INCOMPLETO`, `DEMORA_EXCESIVA`, `PRODUCTO_FRIO`, etc.).
   - Adjunto obligatorio o recomendado de fotografía con validación de peso (máximo 5 MB) y previsualización.
   - Envío mediante `POST /feedback/reportes/multipart`.

3. **Sincronización en Vivo del Estado del Reclamo (`order-tracking`):**
   - Sondeo reactivo mediante `GET /feedback/reportes/orden/{ordenId}`.
   - Badge dinámico según estado: `Reclamo en curso (ABIERTO)`, `✓ Reclamo Atendido (RESUELTO)` o `Reclamo No Procedente (RECHAZADO)`.
   - Visualización de la `Respuesta de la Administración` y ficha informativa de reembolso emitido.

4. **Panel de Gestión de Reclamos y Libro de Reclamaciones (`admin-dashboard`):**
   - Bandeja de reclamos con tarjeta por incidencia.
   - **Ficha del Cliente Afectado:** subtítulo visible con nombre del cliente, teléfono y dirección de entrega asociados a la orden.
   - **Visor de Evidencia Fotográfica (Lightbox):** modal interactivo con backdrop blur que amplía la foto sin navegar ni recargar la ruta `/admin`.
   - **Modal de Resolución:** decisión administrativa (`RESUELTO` / `RECHAZADO`), respuesta obligatoria al cliente y switch de emisión de reembolso monetario directo a pasarela.

---

## 8. Guía de Pruebas para el Equipo

### 8.1 Pruebas Funcionales

| Caso                        | Entrada                                                                        | Resultado Esperado                                                                  |
| :-------------------------- | :----------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| Crear reseña válida         | `POST /feedback/resenias` con `calificacion` 1-5                               | `201` con la reseña registrada                                                      |
| Calificación fuera de rango | `calificacion: 6`                                                              | `400` con el detalle de validación                                                  |
| Reseña duplicada            | Misma orden, mismo cliente                                                     | `409 Conflict`                                                                      |
| Reclamo con foto            | `POST /feedback/reportes/multipart` con campo `foto`                           | `201` con `fotoEvidenciaUrl` servida por `/feedback/evidencias/{fileName}`          |
| Reclamo sin foto            | `POST /feedback/reportes` (JSON)                                               | `201` (la foto es opcional)                                                         |
| Consultar estado por orden  | `GET /feedback/reportes/orden/{ordenId}`                                       | `200` con estado, respuesta del admin y reembolso; `404` si no hay reclamo          |
| Ampliar foto en admin       | Clic en "Ver foto" o miniatura de evidencia                                    | Abre lightbox modal sin redirigir ni salir de `/admin`                              |
| Resolver con reembolso      | `PATCH /feedback/admin/reportes/{id}/resolver` con `reembolsoProcedente: true` | Estado `RESUELTO` + llamada a `POST /pagos/orden/{ordenId}/reembolso`               |
| Resolver sin reembolso      | `PATCH …` con `reembolsoProcedente: false`                                     | Estado actualizado sin llamada externa                                              |
| Descargar evidencia         | `GET /feedback/evidencias/{fileName}`                                          | `200` con los bytes del archivo; `404` si no existe                                 |

### 8.2 Criterios de Aceptación

- [x] Cliente puede calificar de 1 a 5 estrellas una orden entregada.
- [x] Cliente puede adjuntar foto de evidencia en un reclamo.
- [x] Cliente visualiza en tiempo real la resolución y la respuesta oficial de su reclamo.
- [x] Admin visualiza bandeja de reclamos con identificación del cliente afectado (nombre, teléfono y dirección).
- [x] Admin puede ampliar las fotos de evidencia en un modal lightbox sin errores de enrutamiento.
- [x] Admin puede resolver un reclamo y emitir reembolso automático a pasarela de pagos.
- [x] No se permite más de una reseña por orden por cliente.
- [x] Las evidencias quedan en el sistema de archivos del servicio y se sirven en `GET /feedback/evidencias/{fileName}`.
