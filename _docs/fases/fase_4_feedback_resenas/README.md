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
              PostgreSQL (`feedback_db`)
              + Cloud Storage / S3 (fotos)
```

| Componente | Tecnología | Rol |
| :--- | :---: | :--- |
| `feedback-service` | Spring Boot 3.3.4 (Java 21) | Módulo de calificaciones, reclamos y reembolsos |
| `feedback_db` | PostgreSQL (RDS) | Tablas `resenias` y `reportes_incidencia` |
| Cloud Storage / S3 | AWS S3 o GCP Storage | Almacenamiento de fotos de evidencia de reclamos |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código | Tipo | Descripción Oficial | Componente Responsable |
| :--- | :---: | :--- | :--- |
| **RF26** | RF | Los clientes califican (1 a 5 estrellas) y dejan reseñas de sus pedidos completados. | `feedback-service` |
| **RF27** | RF | Los clientes reportan problemas de un pedido adjuntando descripción y evidencia fotográfica. | `feedback-service` + Cloud Storage |
| **RF28** | RF | El administrador visualiza, responde y gestiona el estado de reseñas y reportes (`ABIERTO`, `EN_REVISION`, `RESUELTO`). | `feedback-service` + Frontend Admin |
| **RF29** | RF | El administrador emite reembolsos asociados a reportes procedentes. | `feedback-service` → `payments-service` |

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

    private String fotoEvidenciaUrl; // Enlace a S3 o Cloud Storage

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
**Acceso:** 🔒 `CLIENTE`

**Request Body:**
```json
{
  "ordenId": 52,
  "calificacion": 5,
  "comentario": "Pollo jugoso, papas crocantes y llegó caliente. ¡Excelente!"
}
```

**Validaciones:**
- La orden debe existir y estar en estado `ENTREGADO` (validación vía REST a `orders-service`).
- El cliente solo puede dejar UNA reseña por orden.
- Calificación: entero entre 1 y 5.

**Response `201 Created`:**
```json
{
  "id": 15,
  "ordenId": 52,
  "clienteId": 7,
  "calificacion": 5,
  "comentario": "Pollo jugoso, papas crocantes y llegó caliente. ¡Excelente!",
  "creadoEn": "2026-10-05T10:30:00"
}
```

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
```
POST /feedback/reportes
```
**Acceso:** 🔒 `CLIENTE`

**Content-Type:** `multipart/form-data`

**Campos del formulario:**
| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `ordenId` | `number` | ✅ | Orden existente y entregada |
| `motivo` | `string` | ✅ | Enum `MotivoReclamo` |
| `descripcion` | `string` | ✅ | Mínimo 20 caracteres |
| `foto` | `file` | ❌ | JPEG/PNG, máximo 5 MB |

**Response `201 Created`:**
```json
{
  "id": 8,
  "ordenId": 52,
  "motivo": "PEDIDO_INCOMPLETO",
  "descripcion": "Me faltó la porción de tequeños que pedí en el combo...",
  "fotoEvidenciaUrl": "https://storage.example.com/reclamos/8/evidencia.jpg",
  "estado": "ABIERTO",
  "creadoEn": "2026-10-05T11:00:00"
}
```

### 4.3 Gestión de Reclamos (Admin)

#### Dashboard de Reclamos (RF28)
```
GET /feedback/admin/reportes
```
**Acceso:** 🔒 Solo `ADMIN`

**Query Params opcionales:** `?estado=ABIERTO&desde=2026-10-01&motivo=PEDIDO_INCOMPLETO`

**Response `200 OK`:** `ReporteIncidencia[]` con paginación.

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
  "montoReembolso": 15.00
}
```

**Acciones automáticas si `reembolsoProcedente = true`:**
1. Llama a `payments-service` → `POST /pagos/{pagoId}/reembolso` con el monto autorizado.
2. Actualiza el estado del reporte a `RESUELTO` y registra `resueltoEn`.

---

## 5. Flujo de Emisión de Reembolsos (RF29)

```
Admin (Dashboard)         feedback-service          payments-service       Cliente
       │                         │                         │                  │
       ├── 1. Aprueba reclamo ──►│                         │                  │
       │   (monto = S/ 15.00)   │                         │                  │
       │                         ├── 2. POST /reembolso ──►│                  │
       │                         │      (ordenId, monto)   │                  │
       │                         │                         ├── 3. Reversa     │
       │                         │                         │   (Pasarela/Manual)
       │                         │◄── 4. Reembolso OK ─────┤                  │
       │                         │    (transaccionId)      │                  │
       │◄── 5. Ticket RESUELTO ──┤                         │                  │
```

---

## 6. Variables de Entorno

```properties
# feedback-service (:8085)
DB_URL=jdbc:postgresql://localhost:5432/feedback_db
DB_USERNAME=postgres
DB_PASSWORD=********
JWT_SECRET=<clave-secreta-compartida-min-256-bits>
CORS_ALLOWED_ORIGINS=http://localhost:4200

# Comunicación inter-servicio
ORDERS_SERVICE_URL=http://localhost:8082
PAYMENTS_SERVICE_URL=http://localhost:8083

# Almacenamiento de evidencias
STORAGE_TYPE=S3                          # S3 | LOCAL
S3_BUCKET_NAME=polleria-reclamos
S3_REGION=us-east-1
S3_ACCESS_KEY=***
S3_SECRET_KEY=***
UPLOAD_MAX_SIZE_MB=5
```

---

## 7. Entregables para el Frontend (Angular 19)

1. **Modal Post-Entrega de Calificación:**
   - Disparado automáticamente cuando la orden pasa a `ENTREGADO`.
   - Selector interactivo de 1 a 5 estrellas con tags frecuentes ("Sabor increíble", "Llegó caliente", "Rápido").

2. **Formulario de Reclamo con Preview de Foto:**
   - Carga de evidencia desde cámara del celular o galería.
   - Validación de peso máximo (5 MB) y compresión en cliente.

3. **Panel de Gestión de Quejas y Calificaciones (Admin):**
   - Bandeja de entrada tipo Help Desk con filtros por estado y motivo.
   - Visualizador de fotos de platos dañados o faltantes.
   - Botón directo con confirmación: `"Aprobar y Emitir Reembolso por Pasarela"`.

---

## 8. Guía de Pruebas para el Equipo

### 8.1 Pruebas Funcionales
| Caso | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Crear reseña válida | `POST /feedback/resenias` con orden ENTREGADA | 201 con calificación registrada |
| Reseña duplicada | Misma orden, mismo cliente | 409 Conflict |
| Reseña sin orden entregada | Orden en estado `EN_PREPARACION` | 400 Bad Request |
| Reclamo con foto | `POST /feedback/reportes` con `multipart` | 201 con URL de foto en storage |
| Reclamo sin foto | `POST /feedback/reportes` sin archivo | 201 (foto es opcional) |
| Resolver con reembolso | `PATCH /resolver` con `reembolsoProcedente: true` | Estado RESUELTO + llamada a payments |
| Resolver sin reembolso | `PATCH /resolver` con `reembolsoProcedente: false` | Estado RESUELTO sin llamada externa |

### 8.2 Criterios de Aceptación
- [ ] Cliente puede calificar de 1 a 5 estrellas una orden entregada.
- [ ] Cliente puede adjuntar foto de evidencia en un reclamo.
- [ ] Admin visualiza bandeja de reclamos filtrable por estado.
- [ ] Admin puede resolver un reclamo y emitir reembolso automático.
- [ ] No se permite más de una reseña por orden por cliente.
- [ ] Las fotos se almacenan en Cloud Storage con URL accesible.
