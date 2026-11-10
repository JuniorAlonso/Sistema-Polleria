# Plan de Revisión 5: Libro de Reclamaciones Virtual

**Responsable:** por asignar
**Servicios:** `feedback-service` (8085), `frontEnd` (modal del footer, `/admin/feedback`)
**Tablas:** `libro_reclamaciones` (nueva)
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Reemplazar el formulario simulado del footer por un Libro de Reclamaciones real:

1. Cualquier persona registra una queja o reclamo, sin cuenta y sin pedido asociado.
2. La hoja se guarda en la base de datos de la empresa.
3. El consumidor recibe una copia en su correo mediante Spring Mail.
4. El Administrador atiende la hoja y responde por correo dentro del plazo legal.

**Estado actual:** el formulario no tiene modelo de datos ni backend. `enviarReclamo` solo ejecuta un `alert` que afirma haber enviado una copia que nunca se envía. `feedback-service` no tiene dependencia de correo.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D5.1 | Se implementa en `feedback-service`, en una tabla propia `libro_reclamaciones`. | Es un registro legal distinto del reclamo postventa. `ddl-auto` crea la tabla sola y evita quitar `NOT NULL` en `reportes_incidencia`. |
| D5.2 | `POST /feedback/libro-reclamaciones` es público, en JSON y sin foto. | La hoja no puede exigir cuenta ni un pedido. |
| D5.3 | El número es `LR-{año}-{id con 6 dígitos}`, derivado del id. | Es único sin bloqueos ni contadores. |
| D5.4 | **Primero se guarda, después se envía.** El correo corre fuera de la transacción. | Un fallo de SMTP nunca debe perder la hoja. |
| D5.5 | Un `@Scheduled` cada 5 minutos reintenta los envíos pendientes, hasta 5 intentos. | Asegura la copia sin agregar colas. Requiere `@EnableScheduling` en feedback. |
| D5.6 | Correo en texto plano con `SimpleMailMessage`. No se genera PDF. | Es el patrón de `TwoFactorService`, no agrega dependencias y evita inyección de HTML. |
| D5.7 | Se reutilizan `MAIL_USERNAME` y `MAIL_PASSWORD`, con la misma configuración SMTP de `auth-service`. | Una sola cuenta de correo. |
| D5.8 | Timeouts SMTP de 5 s. Si faltan las credenciales, el servicio arranca y la copia queda pendiente. | Sin timeout, un SMTP colgado retiene el hilo indefinidamente. |
| D5.9 | Límites por consulta a la tabla: 5 hojas por IP por hora y 3 por correo por día. Campo trampa oculto. Al superarlos responde 429 e indica el libro físico. | Un endpoint público que envía correo a cualquier dirección puede usarse para spam. |
| D5.10 | `vence_en` suma 15 días hábiles contando lunes a viernes en hora de Lima. Los feriados cuentan como hábiles. | Da una fecha igual o anterior a la legal, sin mantener un calendario. |
| D5.11 | La lectura y la respuesta son solo `ADMIN`. No hay consulta pública por número. | Contiene datos personales y la copia llega por correo. |
| D5.12 | Las hojas no se editan ni se eliminan: no existe endpoint para hacerlo. | Es un registro legal; se conserva sin vencimiento automático. |
| D5.13 | Los datos del proveedor salen de propiedades `libro.proveedor.*`. | No se fijan en el código. El footer ya muestra razón social y RUC; **falta definir el domicilio**. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿Los campos actuales bastan? | No. Faltan domicilio, bien contratado, monto, pedido del consumidor y apoderado para menores, y los inputs no están enlazados a ningún modelo. | Formulario reactivo con los campos de la sección 5. |
| ¿Qué pasa si falla el correo? | Debe conservarse la hoja. | D5.4 y D5.5; el Admin ve "Copia pendiente". |
| ¿Se puede enviar correo a terceros de forma masiva? | Sí, si no se limita. | D5.9. |
| ¿Se pueden colar datos maliciosos en el correo? | Texto plano y `@Email` evitan inyección de HTML y de cabeceras. | D5.6. |
| ¿Cómo responde la empresa? | La norma exige respuesta escrita, por carta o correo, en 15 días hábiles improrrogables. | `responder` guarda y envía por el mismo mecanismo. |
| ¿Se relaciona con el reembolso del Plan 4? | No. Una hoja no mueve dinero. | Si amerita devolución, el Admin la gestiona por el reclamo postventa. |
| ¿Se debe validar el número de pedido? | No puede ser requisito. | Texto libre opcional, sin llamar a `orders-service`. |
| ¿Puede imprimir la copia? | El reglamento prevé la impresión gratuita de la hoja en el libro virtual. | Botón "Imprimir" en la confirmación, con `window.print()`. |

---

## 4. Flujo de datos

| # | Paso | Frontend | Backend | BD / Correo |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Completar | `libro-reclamaciones-modal`, formulario reactivo con validación | — | — |
| 2 | Enviar | `feedback.service.ts`: `registrarHojaReclamacion`; botón deshabilitado durante el envío | `POST /feedback/libro-reclamaciones`, valida, aplica límites | Consulta de límites |
| 3 | Guardar | — | Transacción: `saveAndFlush`, asigna `numero` y `vence_en` | `libro_reclamaciones` (`PENDIENTE`) |
| 4 | Confirmar | Muestra número, fecha, plazo, correo destino y "Imprimir" | `201` con `numero`, `creadoEn`, `venceEn`, `email` | — |
| 5 | Enviar copia | — | `@Async` después del commit, con `JavaMailSender` | SMTP; `copia_enviada_en` o `copia_intentos+1` |
| 6 | Reintentar | — | `@Scheduled` cada 5 min: sin enviar, `intentos<5`, con más de 2 minutos de antigüedad | Igual que el paso 5 |
| 7 | Atender | Pestaña Libro en `admin-feedback.page`, ordenada por `vence_en` | `GET /feedback/admin/libro-reclamaciones` | Lectura |
| 8 | Responder | Modal de respuesta | `PATCH /feedback/admin/libro-reclamaciones/{id}/responder`; responsable desde el JWT | `respuesta`, `respondido_en`, `respondido_por`, `estado=RESPONDIDO` |
| 9 | Notificar | Indica "Respuesta enviada" o "Pendiente" | Mismo mecanismo de los pasos 5 y 6 | SMTP; `respuesta_enviada_en` |

---

## 5. Cambios por capa

### Base de datos

Tabla nueva, creada por `ddl-auto`, con índices declarados en `@Table`.

| Columna | Tipo | Restricción | Origen |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PK | Sistema |
| `numero` | VARCHAR(20) | UNIQUE, nullable hasta el flush | Sistema |
| `tipo` | VARCHAR(10) | NOT NULL: `QUEJA`, `RECLAMO` | Formulario |
| `nombre_completo` | VARCHAR(150) | NOT NULL | Formulario |
| `tipo_documento` | VARCHAR(5) | NOT NULL: `DNI`, `CE`, `PAS` | Formulario |
| `numero_documento` | VARCHAR(15) | NOT NULL | Formulario |
| `domicilio` | VARCHAR(250) | NOT NULL | Formulario |
| `email` | VARCHAR(150) | NOT NULL | Formulario |
| `telefono` | VARCHAR(15) | NOT NULL | Formulario |
| `apoderado` | VARCHAR(150) | NULL, obligatorio si es menor de edad | Formulario |
| `bien_tipo` | VARCHAR(10) | NOT NULL: `PRODUCTO`, `SERVICIO` | Formulario |
| `bien_descripcion` | VARCHAR(250) | NOT NULL | Formulario |
| `monto_reclamado` | NUMERIC(10,2) | NULL, ≥ 0 | Formulario |
| `numero_pedido` | VARCHAR(30) | NULL | Formulario |
| `detalle` | VARCHAR(2000) | NOT NULL | Formulario |
| `pedido_consumidor` | VARCHAR(1000) | NOT NULL | Formulario |
| `estado` | VARCHAR(12) | NOT NULL: `PENDIENTE`, `RESPONDIDO` | Sistema |
| `creado_en`, `vence_en` | TIMESTAMP | NOT NULL | Sistema |
| `copia_enviada_en` | TIMESTAMP | NULL | Sistema |
| `copia_intentos` | INTEGER | NOT NULL, 0 | Sistema |
| `respuesta` | VARCHAR(4000) | NULL | Admin |
| `respondido_en` | TIMESTAMP | NULL | Sistema |
| `respondido_por` | VARCHAR(150) | NULL | JWT |
| `respuesta_enviada_en` | TIMESTAMP | NULL | Sistema |
| `respuesta_intentos` | INTEGER | NOT NULL, 0 | Sistema |
| `ip_origen` | VARCHAR(45) | NULL, solo para límites | Sistema |

**Índices:** `(email, creado_en)`, `(ip_origen, creado_en)`, `(estado, vence_en)`.

### Infraestructura

| Cambio | Tipo |
| :--- | :--- |
| `feedback-service/pom.xml`: `spring-boot-starter-mail` | Nuevo |
| `application.properties`: `spring.mail.*` con `${MAIL_USERNAME:}` y `${MAIL_PASSWORD:}`, STARTTLS, `connectiontimeout`, `timeout` y `writetimeout` en 5000 | Nuevo |
| `application.properties`: `libro.proveedor.razon-social`, `ruc`, `domicilio` | Nuevo |
| `application-test.properties`: valores de prueba, como en `auth-service` | Nuevo |
| `docker-compose.local.yml`: `MAIL_USERNAME` y `MAIL_PASSWORD` en `feedback-service`, con la misma definición de `auth-service` | Corregir |
| `deploy-gcp-cloudrun.ps1`: las mismas variables para feedback | Corregir |

### Backend (`feedback-service`)

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `entity/HojaReclamacion`, `repository/HojaReclamacionRepository` | Entidad y consultas de límites y pendientes. | Nuevo |
| `dto/CrearHojaRequest` | Bean Validation de todos los campos, `@Email`, regla de documento según tipo, declaración aceptada obligatoria, campo trampa. | Nuevo |
| `dto/HojaResponse`, `dto/ResponderHojaRequest` | Salida pública mínima, salida admin y respuesta. | Nuevo |
| `service/LibroReclamacionesService` | Límites, guardado, número, `vence_en`, respuesta. Una segunda respuesta devuelve 409. | Nuevo |
| `service/LibroCorreoService` | Armado y envío de copia y respuesta. No registra datos personales en logs. | Nuevo |
| `service/LibroCorreoScheduler` | Reintentos de D5.5. | Nuevo |
| `controller/LibroReclamacionesController` | `POST` público; `GET` y `PATCH` con `hasAuthority('ADMIN')`. | Nuevo |
| `SecurityConfig` | `permitAll` solo para `POST /feedback/libro-reclamaciones`. | Corregir |
| `GlobalExceptionHandler` | Respuesta 429 de límites y 400 de validación con el formato `{error}`. | Corregir |
| `FeedbackServiceApplication` | `@EnableScheduling`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `shared/components/libro-reclamaciones/libro-reclamaciones-modal` | Formulario reactivo extraído del footer, estados de envío, éxito y error, número e impresión. | Nuevo |
| `footer.component.ts` | Reemplaza el formulario por el modal y elimina `enviarReclamo` y el `alert`. | Corregir |
| `core/services/feedback.service.ts` | Métodos de registro, listado y respuesta. | Corregir |
| `core/models/api-contracts.model.ts` | Contratos de la hoja. | Corregir |
| `admin-libro-reclamaciones` | Lista con filtro, días restantes, alerta de vencimiento, detalle y respuesta. | Nuevo |
| `admin-feedback.page.ts` | Registra la pestaña Libro. | Corregir |

---

## 6. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R5.1 | Registro público | Sin sesión, una hoja válida responde 201 y crea una fila `PENDIENTE` con número `LR-2026-000001`. También funciona con una sesión iniciada y con un token vencido. |
| R5.2 | Validación | Sin campo obligatorio, con correo inválido, sin aceptar la declaración o con DNI de longitud incorrecta responde 400 y no crea fila. |
| R5.3 | Copia al cliente | El correo llega al consumidor con número, fecha, proveedor, datos completos y plazo de 15 días hábiles. `copia_enviada_en` queda registrada. |
| R5.4 | Fallo de correo | Con SMTP caído la respuesta sigue siendo 201, la fila existe y `copia_intentos` aumenta. Al recuperarse se envía una vez. Tras 5 intentos deja de reintentar y el Admin ve "Copia no enviada". |
| R5.5 | Abuso | La sexta hoja de una IP en una hora y la cuarta de un correo en un día responden 429 sin enviar correo. Con el campo trampa completo no se crea fila. |
| R5.6 | Plazo | Una hoja creada un lunes vence 15 días hábiles después, sin contar sábados ni domingos, en hora de Lima. |
| R5.7 | Confirmación | La UI muestra el número y permite imprimir. El `alert` ya no existe. |
| R5.8 | Atención | `ADMIN` lista y responde: el consumidor recibe la respuesta. Una segunda respuesta devuelve 409. |
| R5.9 | Protección | Sin sesión los `GET` y `PATCH` responden 401. `CLIENTE` y `CAJERO` reciben 403. No existe forma de editar ni borrar una hoja. |

---

## 7. Contratos con otros planes

- **Plan 4:** es dueño de `docker-compose.local.yml` y de `admin-feedback.page`. Este Plan solo agrega las variables de correo al bloque de feedback y registra una pestaña. La `FINANCE_SERVICE_URL` y la `INTERNAL_API_KEY` del Plan 4 no son necesarias aquí.
- **Reclamo postventa (Plan 4):** sigue siendo el canal para pedidos entregados con evidencia y reembolso. Son flujos independientes.

---

## 8. Alcance

**Incluye:** registro público, persistencia, copia por correo, reintentos, atención y respuesta del Administrador.

**No incluye:** PDF adjunto, adjuntar fotos a la hoja, consulta pública por número, calendario de feriados, reporte a Indecopi, ni reemplazo del libro físico del local.

**Antes de producción:**

1. Definir el domicilio del proveedor (D5.13).
2. Contrastar el formulario con el Anexo I vigente del D.S. 011-2011-PCM, modificado por el D.S. 101-2022-PCM. La auditoría no revisó el texto oficial del anexo.
3. Revisar el plazo de conservación y lo que añada la Ley 32495, de 2025. No se pudieron confirmar. Por eso D5.12 no borra hojas.
4. Comprobar el límite diario de envíos de la cuenta SMTP.

---

## 9. Verificación

```bash
cd polleria
./mvnw test -pl feedback-service "-Dtest=LibroReclamacionesServiceTest,LibroCorreoServiceTest,LibroReclamacionesControllerTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/shared/components/libro-reclamaciones/**/*.spec.ts" --include="src/app/features/admin/pages/feedback/**/*.spec.ts"
```

**Tests a crear** (las tres clases son nuevas, con `JavaMailSender` simulado):

- Servicio: guardado antes del envío, número, `vence_en` sobre fin de semana, límites, doble respuesta.
- Correo: contenido de la copia, fallo SMTP sin propagar, tope de reintentos.
- Controlador: público frente a protegido, 400 y 429.
- Frontend: validación, doble envío, confirmación y ausencia del `alert`.

**Prueba manual obligatoria:** una hoja real con la cuenta SMTP configurada y comprobación en la bandeja del destinatario.

**Fuentes normativas:** [D.S. 011-2011-PCM](https://www.inei.gob.pe/media/libro_reclamaciones/DS011_2011_PCM.pdf), [Indecopi, modificación del Reglamento](https://www.gob.pe/institucion/indecopi/noticias/641594-modifican-), [Garrigues, plazo de 15 días hábiles](https://www.garrigues.com/es_ES/noticia/peru-adecua-reglamento-libro-reclamaciones-proveedores-den-respuesta-reclamos-quejas-15-dias).
