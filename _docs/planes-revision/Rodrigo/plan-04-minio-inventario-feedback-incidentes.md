# Plan de Revisión 4: MinIO, Inventario, Reclamos e Incidentes

**Responsable:** Compañero 4
**Servicios:** `orders-service` (8082), `feedback-service` (8085), `incident-service` (8088), `payments-service` (reembolso), MinIO (9000), `frontEnd` (`/admin/inventario`, `/admin/feedback`, `/admin/soporte`, seguimiento de pedido, `/cajero`)
**Tablas:** `productos`, `reportes_incidencia`, `resenias`, `incidentes`, `pagos`, `movimientos_caja`
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Certificar el almacenamiento de imágenes, la consistencia del stock, el reclamo postventa con reembolso y la gestión de incidentes operativos.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D4.1 | Las imágenes se sirven por backend. El frontend nunca consume el puerto 9000. | El puerto sigue publicado en local porque las URL prefirmadas de comprobantes (`FirmadorComprobantes`) dependen de él. |
| D4.2 | Clave fija `productos/{id}`. `imagen_url` guarda `/productos/{id}/imagen?v=<timestamp>`. | Sobrescribe sin huérfanos e invalida la caché del navegador. |
| D4.3 | El seeder corre al final de `DataInitializer`, **producto por producto**: si `imagen_url` empieza con `/assets/images/`, sube el archivo y recién entonces actualiza la URL. | "Bucket vacío" no detecta cargas parciales ni productos nuevos. |
| D4.4 | Comportamiento ante fallo de MinIO: al arrancar, log y se conserva `/assets`; al servir, placeholder con `no-store`; al subir evidencia, 503 sin crear el reclamo. | Reemplaza el "fallback resiliente", que no estaba definido. |
| D4.5 | Evidencias: solo `ADMIN` o el dueño del reclamo; en otro caso, 404. El frontend las descarga como blob. | Son datos personales y `<img>` no envía JWT. |
| D4.6 | La canalización del reembolso depende de la referencia del pago: `MP-\d+` o numérica va a pasarela; el resto es `VENTANILLA`. Incluye Yape manual. | El enum no distingue y `contains("-")` da falsos positivos. |
| D4.7 | Un solo reembolso por pago, solo desde `APROBADO`, con bloqueo y monto ≤ `pago.monto`. Repetir la misma operación devuelve el resultado anterior. | Evita doble devolución sin columna nueva. |
| D4.8 | La devolución en ventanilla se controla con `canal_devolucion` y `devuelto_en`. No se agregan estados. Pendiente = `VENTANILLA` y `devuelto_en` nulo. | Evita migrar el `CHECK` del enum. |
| D4.9 | El Libro de Reclamaciones público sale de este Plan y pasa al [Plan 5](../Junior/plan-05-libro-reclamaciones.md). | Es un flujo legal distinto del reclamo postventa, con tabla y correo propios. |
| D4.10 | Se mantiene el rechazo por stock con **400**. | Lo fijan `OrdenStockTest`, checkout y bot. Corrige R4.3. |
| D4.11 | `responsable` del incidente sale del JWT. Re-resolver responde 409. | Hoy viene del body y es opcional. |
| D4.12 | En producción, MinIO se reemplazará más adelante por Google Cloud Storage. El acceso a objetos queda concentrado en una clase por servicio, y las imágenes se siguen sirviendo por backend. | El cambio queda limitado a esa clase y no afecta al frontend ni a los datos de `imagen_url`. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿Hay imágenes en `resources/images`? | No, las 10 están en `public/assets/images`. | Copiarlas. |
| ¿El seeder cubre una BD vacía? | `DataInitializer` crea productos sin imagen. | Asignarles `imagenUrl`. |
| ¿El upload de 5 MB pasa? | Orders usa el default de 1 MB y no hay `type="file"`. | `max-file-size=6MB`, corte a 5 MB y UI nueva. |
| ¿Se valida el contenido del archivo? | Evidencias solo por header. | Reutilizar la firma (`coincideConFirma`). |
| ¿Se puede crear un reclamo hoy? | **No:** feedback no recibe `INTERNAL_API_KEY` y orders responde 404. | Agregar la variable. Bloqueante para R4.4. |
| ¿Si orders falla al validar? | Se permite el reclamo. | Responder 503. |
| ¿`/feedback/reportes/orden/**` es seguro? | Público: expone datos enumerando el id. | Exigir login y propiedad. |
| ¿Hay riesgo de deadlock en stock? | No, bloquea por id ascendente. | Certificar. |
| ¿Se pueden pisar valores de stock? | Sí: `actualizar` y `toggle` no bloquean. | `buscarConBloqueo`. |
| ¿Reponer deshace un agotado manual? | Sí. | Reactivar solo si el stock estaba en 0. |
| ¿Qué hace hoy un reembolso en efectivo? | Marca `REEMBOLSADO` sin mover dinero. | Flujo 4.4. |
| ¿Qué pasa con los webhooks de MP? | `refunded` cancela órdenes entregadas; `approved` regresa un parcial a `APROBADO`. | Los corrige el [Plan 6](../Altamirano/plan-06-mercado-pago.md), sección 5. |
| ¿El cajero puede registrar incidentes? | No tiene UI y `SecurityAuditService` le daría 403. | Reutilizar el modal con `IncidentsApiService`. |

---

## 4. Flujos de datos

### 4.1 Imagen de catálogo

| Paso | Frontend | Backend | BD / MinIO |
| :--- | :--- | :--- | :--- |
| Sembrar | — | `DataInitializer` según D4.3 | `polleria-catalogo/productos/{id}`, `productos.imagen_url` |
| Subir | Input de archivo en inventario | `POST /productos/{id}/imagen` (`ADMIN`), firma y 5 MB; 413 si excede | Objeto sobrescrito, `?v=` nuevo |
| Servir | `product.adapter` antepone `ordersApiUrl` | `GET /productos/{id}/imagen`, público, caché larga | Lectura de MinIO |

### 4.2 Stock

Crear orden o ronda → `buscarConBloqueo` en orden ascendente → valida `disponible` y `stock` → descuenta y apaga el plato al llegar a 0. La cancelación desde `RECIBIDO`, `PENDIENTE_PAGO` o `PENDIENTE_CONFIRMACION` repone. `PEDIDO_FANTASMA` no repone.

### 4.3 Reclamo con evidencia

| Paso | Frontend | Backend | BD / MinIO |
| :--- | :--- | :--- | :--- |
| Crear | `order-tracking` (`crearReporteMultipart`) | `POST /feedback/reportes/multipart`, valida orden `ENTREGADO`, firma, ignora `fotoEvidenciaUrl` entrante | `reportes_incidencia`, `polleria-feedback/{uuid}.ext` |
| Revisar | Admin carga la foto como blob | `GET /feedback/evidencias/{fileName}` con regex UUID y D4.5 | Lectura de MinIO |

### 4.4 Resolución con reembolso

| # | Paso | Frontend | Backend | BD |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Aprobar | `claim-resolution-modal` | feedback → `POST /pagos/orden/{id}/reembolso` | `pagos.estado`, `reportes_incidencia.estado=RESUELTO`, `canal_devolucion` |
| 2a | Digital | Muestra "Reembolsado" | Pasarela Mercado Pago | `pagos.estado=REEMBOLSADO` |
| 2b | Ventanilla | Muestra "Devolución en ventanilla S/ X" | `canal=VENTANILLA`, autoriza sin mover dinero | `pagos.estado=REEMBOLSADO` |
| 3 | Pendientes | Pestaña Devoluciones del cajero | `GET /feedback/devoluciones/pendientes` (`CAJERO`, `ADMIN`) | Lectura |
| 4 | Entregar | Botón "Entregar" | `PATCH /feedback/reportes/{id}/entregar`: bloqueo, valida pendiente, llama a `POST /finanzas/caja/movimientos` con el JWT del cajero, monto desde BD | `movimientos_caja` (`EGRESO`, motivo `DEVOLUCION-RECLAMO #id ORDEN #x`), `devuelto_en` |

Con la caja cerrada, el paso 4 propaga el 409 y la devolución sigue pendiente.

### 4.5 Incidentes

| Paso | Frontend | Backend | BD |
| :--- | :--- | :--- | :--- |
| Registrar | Modal con título, tipo, severidad y descripción; reutilizado por el Cajero | `POST /incidentes` (agrega `CAJERO`) | `incidentes`, `reportado_por` |
| Resolver | Botón y modal solo en no resueltos | `PATCH /incidentes/{id}/resolver`, fuerza `RESUELTO` | `causa_raiz`, `solucion_aplicada`, `resuelto_en`, `responsable` |

---

## 5. Cambios por capa

### Base de datos e infraestructura

| Cambio | Tipo |
| :--- | :--- |
| `reportes_incidencia.canal_devolucion VARCHAR NULL`, `devuelto_en TIMESTAMP NULL` | Nuevo |
| `incidentes.reportado_por VARCHAR NULL` | Nuevo |
| Buckets `polleria-catalogo` y `polleria-feedback`, creados al arrancar si faltan | Nuevo |
| Compose: variables MinIO y `depends_on` en orders y feedback; `INTERNAL_API_KEY` y `FINANCE_SERVICE_URL` en feedback | Corregir |
| `orders-service`: dependencia MinIO y `MinioConfig` copiado de payments | Nuevo |
| `incident.service.url` por defecto: de 8087 a 8088 | Corregir |

### Backend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `ProductoController`, `ProductoService` | Endpoints de imagen, `COCINA` en disponibilidad, `buscarConBloqueo`, reactivación corregida. Un PUT no pisa `imagenUrl` en MinIO. Borrado best-effort del objeto. | Corregir |
| `DataInitializer` | Seeder e `imagenUrl` de los productos iniciales. | Corregir |
| `FileStorageService` | Migra a MinIO, sin disco ni fallback. Valida firma. | Corregir |
| `SecurityConfig` y `ReporteIncidenciaController` (feedback) | Evidencias y `/reportes/orden/**` autenticados con propiedad. | Corregir |
| `ReporteIncidenciaService`, `OrdersClient` | Fail-closed (503), bloqueo también con `RECHAZADO`, un reclamo procedente por orden. | Corregir |
| Endpoints de devoluciones y `FinanceClient` | Flujo 4.4. | Nuevo |
| `PagoService.reembolsar`, `MercadoPagoGateway` | D4.6 y D4.7, respuesta con `canal`. | Corregir |
| `IncidenteController`, `IncidenteService` | `CAJERO`, D4.11, `reportado_por`, alinear `EN_PROCESO` con `EN_INVESTIGACION`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `product-create-modal`, `admin-inventario.page` | Carga de archivo con vista previa. | Nuevo |
| `product.adapter.ts` | URL absoluta para `/productos/`. | Corregir |
| `claim-resolution-modal`, `photo-viewer-modal`, `feedback.service.ts` | Foto como blob. Canal de devolución visible. | Corregir |
| `cajero-devoluciones-tab` | Lista y botón "Entregar". | Nuevo |
| `incidents-log`, `admin-soporte.page` | Output `resolveRequested` y modal de resolución. | Nuevo |
| Dashboard del cajero | Botón de incidente con `incident-create-modal`. | Nuevo |

---

## 6. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R4.1 | Siembra y entrega | Con `docker compose -f docker-compose.local.yml up`, cada producto con imagen local queda en MinIO y el navegador no hace requests al puerto 9000. Con MinIO caído se ve el placeholder. |
| R4.2 | Subida | `ADMIN` sube JPEG o PNG ≤ 5 MB y ve la imagen nueva sin limpiar caché. Mayor a 5 MB: 413. Archivo renombrado sin firma válida: 400. Sin rol: 403. |
| R4.3 | Concurrencia de stock | Dos pedidos simultáneos por la última unidad: uno se crea y el otro responde **400**; stock nunca negativo. Probado sobre PostgreSQL. |
| R4.4 | Reclamo | Cliente con orden `ENTREGADO` adjunta foto: queda en `polleria-feedback`. El Admin la ve. Otro cliente: 404. Anónimo: 401. |
| R4.5 | Reembolso | Mercado Pago: devuelve por pasarela una sola vez. Ventanilla: queda pendiente, el cajero entrega, se crea un `EGRESO` y no se repite. Caja cerrada: 409 y sigue pendiente. |
| R4.6 | Incidente | `ADMIN` resuelve: `RESUELTO`, marca de tiempo y `responsable` del JWT. Segunda resolución: 409. `CAJERO` registra pero no lista. |

---

## 7. Contratos con otros planes

- **Entrega a Plan 1:** `COCINA` en disponibilidad, `imagenUrl` absoluta.
- **Entrega a Plan 2:** motor de reposición de stock.
- **Recibe de Plan 3:** `POST /finanzas/caja/movimientos` sin cambios y registro de la pestaña en el dashboard.

---

## 8. Alcance

**Incluye:** MinIO, stock, reclamos postventa, reembolsos e incidentes.

**No incluye:** Libro de Reclamaciones público (Plan 5), reembolsos parciales múltiples, migración de `./uploads` (volumen efímero sin datos reales; si los hubiera, `mc cp` manual), migración a Google Cloud Storage (etapa posterior, D4.12), efecto fiscal del reembolso.

---

## 9. Verificación

```bash
cd polleria
./mvnw test -pl feedback-service,incident-service "-Dtest=ReporteIncidenciaServiceTest,IncidenteServiceTest"
```

```bash
cd polleria
./mvnw test -pl orders-service "-Dtest=OrdenStockTest,ProductoStockTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/admin/pages/inventario/**/*.spec.ts" --include="src/app/features/admin/pages/feedback/**/*.spec.ts" --include="src/app/features/admin/pages/soporte/**/*.spec.ts"
```

**Tests a crear:** concurrencia de stock sobre PostgreSQL con el patrón de `MesaComandaUnicaConcurrenteTest`, reembolso (canal, doble ejecución), devolución en ventanilla y los specs inexistentes de `admin-inventario.page` y `admin-feedback.page`.
