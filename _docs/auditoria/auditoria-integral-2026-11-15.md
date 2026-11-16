# Auditoría integral del Sistema Pollería

- **Fecha:** 2026-11-15
- **Rama auditada:** `feature/pagos-finanzas-zaja`, commit `87fb6c5` (incluye `main`, la rama de Nallely, la de Rodrigo y la integración de Mercado Pago).
- **Alcance:** los siete servicios de `polleria/` (auth, orders, payments, feedback, finance, incident y notification-service), el frontend `frontEnd/`, los archivos de despliegue y las pruebas.
- **Modo:** solo lectura. No se cambió código para esta auditoría.

## Cómo se hizo

Se corrieron cinco auditorías independientes en paralelo, cada una con un enfoque distinto:

1. **Seguridad y autorización:** endpoints públicos, dueño de cada recurso, JWT, clave interna, CORS, archivos subidos y secretos.
2. **Flujos de dinero y consistencia:** cobro online y en caja, contra entrega, reembolsos, arqueo, balance, stock y comprobantes.
3. **Concurrencia y resiliencia:** carreras, bloqueos, transacciones que incluyen llamadas remotas, timeouts, errores tragados y colas.
4. **Frontend:** adaptadores, guards, manejo de errores, doble envío, formularios y flujos de checkout, cajero, mozo y admin.
5. **Configuración, despliegue, esquema y pruebas:** variables de entorno, valores por defecto, `ddl-auto=update`, Dockerfiles, Cloud Run y CI.

Cada hallazgo trae la línea de código, un escenario concreto de falla y una corrección sugerida. Los críticos y una muestra de los altos se verificaron a mano contra el código; los que no se pudieron confirmar dicen **"por confirmar"**. Cuando dos auditorías encontraron lo mismo, se deja en una sección y la otra lo cita por su ID.

**Ningún secreto se transcribe en este documento.** Donde hay uno, se indica solo el archivo y la línea.

## Resumen

| Sección | Crítica | Alta | Media | Baja | Total |
| :-- | --: | --: | --: | --: | --: |
| 1. Seguridad y autorización (SEC) | 2 | 4 | 3 | 5 | 14 |
| 2. Dinero y consistencia (DIN) | 0 | 6 | 5 | 3 | 14 |
| 3. Concurrencia y resiliencia (CON) | 1 | 4 | 10 | 4 | 19 |
| 4. Frontend (FE) | 0 | 5 | 8 | 6 | 19 |
| 5. Configuración, despliegue y pruebas (CFG) | 1 | 5 | 6 | 6 | 18 |
| **Total** | **4** | **24** | **32** | **24** | **84** |

La sección de dinero no tiene críticos propios porque sus dos críticos (Yape OTP y reembolso doble) ya figuran como SEC-02 y CON-01.

## Qué atender primero

**Acciones fuera del código, inmediatas** (secretos que ya están en GitHub):

1. Rotar el access token de Mercado Pago que quedó en la historia (commit `59b971e`).
2. Revocar la contraseña de aplicación de Gmail versionada (CFG-01).
3. Rotar el `JWT_SECRET`, la `INTERNAL_API_KEY` y la `NOTIFICATION_API_KEY` del compose y sacarlos a un `.env` ignorado (SEC-05).

**Cambios de código, en este orden:**

| Prioridad | IDs | Por qué |
| :-- | :-- | :-- |
| 1 | SEC-01 | Cualquiera puede registrarse como ADMIN. |
| 2 | SEC-02, SEC-04 | Pedidos que entran a cocina como pagados sin cobro. |
| 3 | CON-01, DIN-05, DIN-12, CON-11 | Reembolsos dobles o sin tope: salida directa de dinero. |
| 4 | SEC-03, DIN-02 | Un cliente cancela pagos y pedidos ajenos. |
| 5 | CON-04, DIN-01, DIN-06 | Pagos cobrados sobre pedidos cancelados o degradados. |
| 6 | DIN-03 | El balance diario cuenta dos veces el contra entrega (error introducido en esta rama). |
| 7 | DIN-04, CON-05, CON-06, FE-01 | Liquidaciones de repartidor que pierden o duplican efectivo. |
| 8 | CFG-02, CFG-06 | Servicios que pueden no arrancar y pruebas que pasan sin ejecutarse. |
| 9 | SEC-06, SEC-08 | Fuerza bruta de login, 2FA y código de seguimiento. |

## Problemas ya conocidos antes de esta auditoría

Se listan para tener todo en un solo lugar; no se cuentan en el resumen.

| Tema | Estado |
| :-- | :-- |
| El retorno y el webhook de Mercado Pago aprobaban sin verificar con Mercado Pago | Corregido en esta rama (`c9397c8`, `40c663c`) |
| Token real de Mercado Pago en `docker-compose.local.yml` | Quitado del archivo (`c9397c8`); falta rotarlo |
| Los pagos online no generan comprobante ni movimiento de caja, así que no entran en las ventas del día | Abierto (plan 6) |
| Efectivo y comprobantes del balance se filtran por fechas distintas | Abierto |
| Llamada a Orders API de Mercado Pago sin timeout de respuesta | Abierto (plan 6) |
| Carrera entre el retorno y el webhook al confirmar | Abierto (plan 6) |
| `checkout-status.component.spec.ts` con 2 tests fallando desde `main` | Abierto (plan 6) |
| SDK JS de Mercado Pago agregado y sin uso | Abierto (plan 6) |
| El ticket reimpreso desde el historial del cajero dice "Comprobante pendiente" | Abierto |
| Dos avisos de éxito al cerrar la caja | Abierto |
| Los contenedores locales corren una imagen vieja | Explicado por CFG-09 |
| Reiniciar notification-service resetea la configuración del panel | Abierto |

---

## 1. Seguridad y autorización

Rutas relativas a `polleria/` salvo indicación. Verificados en el código: SEC-01 y SEC-02. No se transcribe ningún secreto.

### Severidad crítica

| ID | Hallazgo | Evidencia | Escenario de explotación | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| SEC-01 | El registro público deja elegir el rol, incluido ADMIN | `auth-service/.../dto/RegisterRequest.java:30-31`; `service/AuthService.java:53`, `:57-72`; `config/SecurityConfig.java:85` (`/auth/register` en `permitAll`). El frontend fija `CLIENTE` (`core/adapters/auth.adapter.ts:75`) pero el backend no valida. | `POST /auth/register {..., "role":"ADMIN"}` devuelve un JWT de ADMIN válido 24 h, sin 2FA. Con él: reembolsar cualquier pago, ver finanzas, gestionar catálogo, ver el QR de WhatsApp. | Quitar `role` del DTO público y forzar `CLIENTE`; las cuentas de personal solo desde un endpoint ADMIN. |
| SEC-02 | `POST /pagos/yape-otp` es público y aprueba sin pasarela | `payments-service/.../config/SecurityConfig.java:81`; `service/PagoService.java:688-704` (solo rechaza `"000000"` o longitud ≠ 6) | Un invitado crea su pedido y envía cualquier OTP de 6 dígitos: el pedido entra a cocina como pagado sin cobro. Nota: Yape se mantiene simulado por decisión del equipo; aun así no debe quedar expuesto en producción. | Desactivarlo fuera de `dev`/`test` o verificar el pago real en Mercado Pago antes de aprobar. |

### Severidad alta

| ID | Hallazgo | Evidencia | Escenario de explotación | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| SEC-03 | Un CLIENTE puede cancelar el pago (y el pedido) de cualquier persona | `payments-service/.../controller/PagoController.java:303-307`; `service/PagoService.java:400-408`; `NotificadorOrden.java:68-74` | Recorrer `PATCH /pagos/1..N/cancelar` cancela pagos PENDIENTE, PENDIENTE_VERIFICACION o RECHAZADO ajenos y sus pedidos (orders acepta por clave interna). | Exigir dueño (`AutorizacionPago.verificarLectura`) cuando no es personal. |
| SEC-04 | Sin token de Mercado Pago, `POST /pagos` con TARJETA aprueba cualquier token | `gateway/PaymentGatewayService.java:38-45`; `gateway/TarjetaGateway.java:24-44`; `application.properties:66` | Un cliente dueño de su orden envía `tokenPasarela:"x"` y queda pagado sin cobro. YAPE_PLIN simulado: por confirmar. | Registrar los gateways simulados solo con `@Profile("dev","test")` y fallar cerrado en otros entornos. |
| SEC-05 | Secreto JWT compartido versionado e idéntico al fallback de notification-service | `docker-compose.local.yml:68, 100, 140, 178, 217, 246, 299`; `notification-service/src/config.js:96`. También versionados `INTERNAL_API_KEY`, `NOTIFICATION_API_KEY` y contraseñas de BD/pgAdmin. | Quien lee el repo firma un HS256 con `role: ADMIN` y entra a todos los servicios que usen ese compose; en notification-service basta que falte `JWT_SECRET` para aceptar ese secreto público (QR de WhatsApp, historial con datos personales). Si algún despliegue real usa este compose: por confirmar. | Rotar, mover a `.env` ignorado o gestor de secretos y quitar el fallback de `config.js:96`. |
| SEC-06 | El bloqueo por IP confía en `X-Forwarded-For`: fuerza bruta de login y 2FA | `auth-service/.../service/AuthService.java:178-184`; `filter/IpBlacklistFilter.java:52`; `TwoFactorService.java:28`, `:57-72` | Cambiar el header en cada intento evita el bloqueo; el código 2FA de 6 dígitos se puede probar masivamente en 5 min; además se puede bloquear la IP de otra persona. | Usar `getRemoteAddr()` (o `ForwardedHeaderFilter` solo tras proxy confiable) y limitar intentos por código y por cuenta. |

### Severidad media

| ID | Hallazgo | Evidencia | Escenario | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| SEC-07 | notification-service abierto sin clave interna y comparación no constante; la clave del QR viaja en la URL | `notification-service/src/http/auth.js:32-35`; `config.js:99`; `app.js:107, 140, 182, 220, 378` | Sin `NOTIFICATION_API_KEY`, cualquiera hace que el WhatsApp oficial envíe mensajes arbitrarios (riesgo de baneo). | Fallar cerrado, `crypto.timingSafeEqual` y clave del QR por header. |
| SEC-08 | Código de seguimiento de 4 dígitos y enumeración de teléfonos de clientes | `orders-service/.../service/SeguimientoService.java:41, 70-73, 76-79, 82` | ~50 % de probabilidad diaria de obtener el token de un teléfono ajeno (ver y cancelar sus pedidos); 429 vs 202 revela qué teléfonos son clientes. | 6 dígitos, límite diario por teléfono y respuesta idéntica aunque no haya pedidos. |
| SEC-09 | Un REPARTIDOR puede ver las liquidaciones de otros | `finance-service/.../controller/LiquidacionController.java:67-71` | Recorrer `repartidorId=1..N` muestra montos y fondos ajenos. | Misma guarda de dueño que los endpoints vecinos (`:74-101`). |

### Severidad baja

| ID | Hallazgo | Evidencia | Corrección sugerida |
| :-- | :-- | :-- | :-- |
| SEC-10 | Reseñas ocultas por moderación legibles por orden, con `clienteId` | `feedback-service/.../controller/ReseniaController.java:52-55`; `service/ReseniaService.java:62-65`; `dto/ReseniaResponse.java:18` | Filtrar `visible=true` salvo ADMIN o dueño y no exponer `clienteId`. |
| SEC-11 | El token de seguimiento se acepta como sesión en payments, feedback, finance e incident | `orders-service/.../SeguimientoService.java:114-120`; `payments/filter/JwtAuthFilter.java:64-69` (solo orders lo descarta) | Rechazar `tipo=seguimiento` en todos los filtros o usar otra clave/audiencia. |
| SEC-12 | El código 2FA queda en los logs si falla el correo | `auth-service/.../service/TwoFactorService.java:50-52` | No registrarlo fuera de `dev`. |
| SEC-13 | JWT de 24 h sin revocación; el rol del claim se confía todo ese tiempo | `auth-service/src/main/resources/application.properties:24` | Access token corto (15 min) con refresh o `tokenVersion`. |
| SEC-14 | CORS agrega loopback con credenciales también en producción | `payments/config/SecurityConfig.java:50-60, 128` (patrón en todos los servicios) | Loopback solo con perfil `local`. |

### Verificado sin problemas

- `X-Internal-Key` en Java usa `MessageDigest.isEqual` y falla cerrado con clave vacía (orders, payments, finance, auth, incident).
- JJWT valida firma y expiración; notification-service limita algoritmos a HS*.
- Órdenes, pagos (lectura), reclamos y evidencias verifican dueño; `POST /pagos` exige dueño de la orden.
- Subidas a MinIO validan content-type, magic bytes y tamaño, con nombres generados por el servidor.
- `frontEnd/.env` y `polleria/.env` están en `.gitignore`; `deploy-gcp-cloudrun.ps1` lee secretos de un `.env` local.
- Ya corregido en esta rama: el retorno y el webhook de Mercado Pago verifican el pago contra Mercado Pago (`c9397c8`, `40c663c`). Pendiente: rotar el token de Mercado Pago que quedó en el historial (`59b971e`).

---

## 2. Flujos de dinero y consistencia de datos

Rutas relativas a `polleria/` salvo indicación. Verificados en el código: DIN-03 y DIN-05. Los hallazgos que coinciden con otra sección se citan por su ID y no se repiten.

**Coincidencias con otras secciones:** Yape OTP aprueba sin cobrar (SEC-02, crítico); un cliente cancela pagos ajenos (SEC-03); la tarjeta simulada aprueba cualquier token sin credencial de Mercado Pago (SEC-04); reembolso doble sin bloqueo (CON-01); pago aprobado sobre una orden ya expirada (CON-04); doble cobro y registros huérfanos en liquidaciones (CON-05, CON-06).

### Severidad alta

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| DIN-01 | Pago aprobado sobre un pedido ya cancelado: el dinero queda sin devolución (complementa CON-04) | `payments-service/.../service/PagoService.java:374-397` (`confirmar`) y `:634-637` (retorno) no revisan la orden, a diferencia de `verificar` (`:280-284`); `NotificadorOrden.enviarEstado` se traga el error; `orders-service/.../OrdenService.java:827` rechaza `CANCELADO→RECIBIDO` | Si orders no responde en el momento del webhook, el pedido sigue impago y se cancela a los 15 min con el dinero cobrado. | Verificar `PENDIENTE_PAGO` antes de aprobar; si la orden es terminal, reembolsar automáticamente; reintentar o encolar la notificación a orders. |
| DIN-02 | Cancelar un pago ajeno también borra transferencias en revisión y reembolsos (amplía SEC-03) | `PagoController.java:303-307`; `PagoService.cancelar` (399-409); `validarTransicion` (532-537) | Un Yape en `PENDIENTE_VERIFICACION` (el cliente ya transfirió) pasa a `CANCELADO` con su orden; un pago `REEMBOLSADO` pasa a `CANCELADO` y se pierde el registro del reembolso; un contra entrega cancela un pedido que ya se cocina. | Exigir dueño o personal y permitir cancelar solo desde `PENDIENTE` o `RECHAZADO`. |
| DIN-03 | **El balance diario cuenta dos veces el delivery contra entrega e incluye boletas de pedidos cancelados** (introducido en `1e1cba9`, esta rama) | La boleta contra entrega se emite al confirmar la llamada (`frontEnd/.../cajero-dashboard.component.ts:752`); la rendición entra como `RENDICION_REPARTIDOR` sin `ordenId`; `finance-service/.../service/FinanzasService.java:75-82` solo reconoce como efectivo las `VENTA` con `ordenId`, así que esa boleta cae en digital; `ComprobantePago` no tiene anulación | Pedido contra entrega de S/50 entregado y liquidado: `totalIngresos` suma 50 (rendición) + 50 (digital) = 100. Un pedido fantasma o cancelado después de la llamada sigue sumando su boleta. | Excluir de digital las boletas con `estadoPagoTexto` "COBRAR EN EFECTIVO" (o marcar las órdenes contra entrega liquidadas) y agregar anulación de comprobantes. |
| DIN-04 | Reembolsar un cobro contra entrega aún no liquidado lo saca de lo que el repartidor debe rendir | `PagoRepository.efectivoPendienteDeRepartidor` filtra `APROBADO`; `PagoService.reembolsar` (430-433); `finance-service/.../LiquidacionService.cerrar` (161-171) | El repartidor cobra S/50, se acepta un reclamo de S/10 antes de liquidar: el cajero paga 10 de caja y la liquidación ya no espera los 50. Pérdida: 60 sin diferencia visible. | Calcular lo pendiente sobre los cobros contra entrega del repartidor en cualquier estado posterior a `APROBADO`, restando solo lo reembolsado. |
| DIN-05 | El reembolso no tiene tope respecto de lo pagado | `ResolverReporteRequest` solo exige `@DecimalMin 0.10`; `PagoService.reembolsar` (430): un monto mayor solo marca `REEMBOLSADO`; `feedback-service/.../ReporteIncidenciaService.marcarEntregado` (172-177) saca ese monto de caja | Pedido de S/50 resuelto con `montoReembolso = 500` por error de tipeo: payments responde 200 y el cajero entrega S/500. | Rechazar `monto <= 0` o mayor que lo pagado menos lo ya reembolsado, guardando el acumulado. |
| DIN-06 | El webhook puede degradar un pago APROBADO a RECHAZADO o CANCELADO (por confirmar el disparador) | `PagoService.actualizarEstadoDesdePasarela` (452-470) solo protege `APROBADO→PENDIENTE`; `MercadoPagoWebhookController.aplicarEstadoDePasarela` (135-146) | Un intento rechazado y otro aprobado con la misma referencia: si el webhook del rechazado llega después, el pago aprobado pasa a RECHAZADO, desaparece de los reportes y queda reemplazable. | Desde `APROBADO` solo permitir pasar a estados de reembolso. |

### Severidad media

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| DIN-07 | `confirmar` reabre pagos reembolsados o rechazados; un REPARTIDOR puede aprobar un Yape que el cajero rechazó | `validarTransicion` (532-537); `PagoController:289-300` | Tras un reembolso parcial el pago sigue `approved` en Mercado Pago (por confirmar); el webhook lo vuelve a `APROBADO`, reenvía el WhatsApp y se pierde el reembolso. | Limitar `confirmar` a `PENDIENTE`, quitar el rol REPARTIDOR y tratar `partially_refunded` como reembolso parcial. |
| DIN-08 | Cobro en caja con un método distinto al del pago pendiente | `frontEnd/.../cobro-salon.facade.ts:51, 105-109`; `confirmar` no actualiza `metodoPago` | Falla un intento con TARJETA y el cajero reintenta con EFECTIVO: se confirma como TARJETA, no entra el ingreso y el arqueo muestra sobrante (o al revés). | Que `confirmar` fije el método o recrear el pago al cambiarlo. |
| DIN-09 | Una ronda agregada después del cobro queda sin pagar | `orders-service/.../OrdenService.agregarItems` (154-195); la fachada no verifica la mesa con pago ya aprobado; el comprobante toma el monto del pago | El cobro falla en comprobante o cierre, el mozo agrega platos, el reintento cierra la comanda y la segunda ronda nunca se cobra. | Bloquear `agregarItems` con pago `APROBADO` o comparar total y pago antes de cerrar. |
| DIN-10 | El efectivo de pedidos para recojo queda fuera del balance y puede duplicarse | `frontEnd/.../cajero-dashboard.component.ts:873-890` (movimiento `MANUAL` sin `ordenId`, solo si la caja en caché está abierta) | La venta de recojo no aparece como venta; con la caja cerrada no queda registro; un reintento duplica el ingreso. | Registrar el ingreso en backend con `categoria = VENTA` y `ordenId`, en la misma operación de cobro. |
| DIN-11 | Una referencia numérica escrita por el cajero se toma como id de pago de Mercado Pago | `MercadoPagoGateway.esPagoMercadoPago` (206) acepta `^\d+$`; `procesarReembolso` (218-246); el cajero escribe la referencia libre (`cajero-dashboard.component.ts:574-576`) | Al reembolsar un Yape cobrado en caja con operación "12345678", Mercado Pago responde 404 y el reclamo no se puede resolver; si coincide con un pago real, se reembolsa otro pago. | Guardar el id de Mercado Pago en un campo propio, llenado solo por el webhook o el retorno verificado. |

### Severidad baja

| ID | Hallazgo | Evidencia | Corrección sugerida |
| :-- | :-- | :-- | :-- |
| DIN-12 | Un reclamo RESUELTO se puede reabrir y resolver de nuevo con otro reembolso | `feedback-service/.../ReporteIncidenciaService.cambiarEstado` (101-108) | No permitir salir de estados terminales. |
| DIN-13 | Se puede emitir boleta para un pedido cancelado y no existe anulación | `finance-service/.../ComprobanteService.emitir` | Validar la orden y agregar anulación. |
| DIN-14 | `procesarCobroEfectivo` no verifica que el repartidor sea el asignado a la orden | `PagoService.java:724-788` | Comparar con `orden.repartidorId`. |

---

## 3. Concurrencia y resiliencia

Rutas relativas a `polleria/` salvo indicación. Verificados en el código: CON-01 y CON-04.

### Severidad crítica

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CON-01 | Reembolso doble: sin bloqueo, sin idempotencia y con la llamada a Mercado Pago dentro de la transacción | `payments-service/.../service/PagoService.java:411-436` (`buscar` sin bloqueo, `procesarReembolso` antes de guardar, acepta repetir desde `REEMBOLSADO_PARCIAL`); `feedback-service/.../service/PaymentsClient.java:39` envía `Idempotency-Key` que payments ignora; `ReporteIncidenciaService.resolver` (l.110-145) sin bloqueo | Doble clic o dos admins resuelven el mismo reclamo: dos reembolsos parciales en Mercado Pago. Si el guardado de feedback falla tras el reembolso, el reintento reembolsa otra vez. | Bloquear el pago (`buscarConBloqueo`), guardar la clave de idempotencia por reclamo con índice único antes de llamar a Mercado Pago y bloquear el reclamo en `resolver`. |

### Severidad alta

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CON-02 | Clientes HTTP sin timeout compartiendo el pool `@Async` (8 hilos, cola sin límite) | `payments-service/.../config/RestClientConfig.java:16-18`; `WhatsappNotificationClient.java:46`; `orders-service/.../NotificationService.java:46`; `feedback-service/.../FinanceClient.java:22`, `OrdersClient.java:29`, `PaymentsClient.java:20` | Si notification-service acepta conexiones y no responde, los 8 hilos de payments se cuelgan y los avisos "pago aprobado → RECIBIDO" quedan encolados: los pedidos pagados no llegan a cocina y expiran (CON-04). | Fábrica común con 3 s/5 s (como `finance/.../TiemposEspera.java`) y executor separado para WhatsApp. |
| CON-03 | `FOR UPDATE` y conexión de BD retenidos durante llamadas remotas sin timeout | `PagoService.verificar` (l.245, l.260, ~l.278); `ReporteIncidenciaService.java:110-145, 155-181` | Si orders se cuelga, cada verificación de Yape retiene la fila y una conexión; con 10 se agota el pool de payments y los webhooks del mismo pago se bloquean. | Timeouts y llamada remota fuera del bloqueo o después del commit. |
| CON-04 | Pago aprobado en Mercado Pago después de que la orden expiró: queda cobrado sobre una orden CANCELADA | `orders-service/.../scheduler/OrdenExpiracionScheduler.java:34, 52-62`; `OrdenRepository.java:111-112`; sin `date_of_expiration` en la preferencia; `PagoService.confirmar` (l.374-396) no revisa la orden; `NotificadorOrden.java:81-83` se traga el rechazo | El cliente paga en el minuto 14 y el webhook llega en el 16: pago APROBADO, orden CANCELADA con stock devuelto, sin alerta ni reembolso. | Fijar la expiración de la preferencia igual al plazo y, en `confirmar`, detectar la orden terminal y marcar el pago para reembolso o alerta. |
| CON-05 | Liquidaciones de repartidor: verificar y luego actuar sin bloqueo ni índice único | `finance-service/.../service/LiquidacionService.java:33, 126, 266-306`; `config/InicializadorIndicesFinanzas.java` (sin índice por repartidor abierto); `LiquidacionRepartidor` sin `@Version` | Dos cajeros cobran a la vez al mismo repartidor: ambos pasan la validación de saldo, entran dos ingresos y se rinde de más; o quedan dos liquidaciones ABIERTAS. | Índice único parcial `uq_liquidacion_abierta_repartidor` y `PESSIMISTIC_WRITE` también en `registrarCobro`. |

### Severidad media

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CON-06 | Commit parcial entre servicios en `registrarCobro` | `LiquidacionService.java:277-284, 334-340`; `PagoService.liquidarEfectivo` (~l.859) | Si finance revierte o el timeout salta después de que payments confirmó, los pagos quedan con un `liquidacion_id` inexistente y las siguientes liquidaciones dan 409 para siempre. | Confirmar la liquidación antes o llamar a `liquidar` en `afterCommit` con reintento idempotente. |
| CON-07 | Conflictos de `@Version` e integridad responden 500 en payments y feedback | `payments-service/.../entity/Pago.java:94`; su `GlobalExceptionHandler` (l.119); `procesarCobroEfectivo` usa `save` (l.795); `feedback-service/.../entity/ReporteIncidencia.java:63` y su handler (l.66) | Dos cobros en efectivo simultáneos de una orden sin pago dan 500 en vez de 409; finance lo traduce a 503. | Mapear ambas excepciones a 409, como `orders-service/.../GlobalExceptionHandler.java:82-94`. |
| CON-08 | Notificaciones `@Async` disparadas antes del commit | `PagoService.confirmar` l.392-393, `cancelar` l.406, `procesarCobroEfectivo` l.798, `verificar` ~l.293; `OrdenService.actualizarEstado` l.413-416 | El perdedor de una carrera hace rollback pero su WhatsApp, sanción o paso a ENTREGADO ya salió. | Enviar en `afterCommit`, como `avisarAprobacionTrasConfirmar`. |
| CON-09 | El webhook responde 200 también cuando falla el procesamiento local | `payments-service/.../controller/MercadoPagoWebhookController.java:73-78, 104-111` | Deadlock o BD caída durante `confirmar` → 200; Mercado Pago no reintenta y el pago queda aprobado allá y pendiente acá. | Devolver 5xx ante fallas locales. |
| CON-10 | El cierre de caja no bloquea el arqueo | `finance-service/.../service/CajaService.java` (`cerrarCaja`, `registrarMovimiento`); `RegistradorIngresoCaja` | Una venta registrada durante el cierre queda en un arqueo CERRADO cuyos totales no la incluyen; doble cierre = último gana. | `PESSIMISTIC_WRITE` sobre el arqueo al cerrar y bloqueo compartido al registrar. |
| CON-11 | Reclamos duplicados por orden | `feedback-service/.../service/ReporteIncidenciaService.java:38`; `entity/ReporteIncidencia.java:11` (índice no único) | Un doble envío crea dos reclamos y cada uno puede reembolsarse (agrava CON-01). | Índice único en `orden_id` y 409 ante la violación. |
| CON-12 | `GET /pagos` sin paginación consultado cada 2,5 s y firmando una URL de MinIO por fila | `frontEnd/.../admin-dashboard.component.ts:334-339`; `PagoRepository.java:27`; `PagoController.java:340-345`; también `ComprobanteService.listarTodos` y listados de feedback/incident | Con meses de historial, cada pestaña de admin trae y firma la tabla completa cada 2,5 s. | Paginar o filtrar por día/estado. |
| CON-13 | La verificación de sanción falla abierta | `SancionDispatcherService.java:76-79` | Con auth caído o lento, un cliente sancionado puede pedir contra entrega. | Fallar cerrado para contra entrega (503) o cachear sanciones. |
| CON-14 | Cola de WhatsApp: una desconexión agota los reintentos y bloquea la cola | `notification-service/src/whatsapp/client.js:345`; `breaker.js:22-25`; `service.js:189-199`; `config.js:66` | Con ~2 min de desconexión todas las notificaciones en cola terminan en ERROR y no se reenvían al reconectar. | Tratar la desconexión como pausa sin consumir intentos y reanudar con `ready`. |
| CON-15 | La rotación del refresh token no bloquea el token (por confirmar con varias pestañas) | `auth-service/.../RefreshTokenService.java:40-65`; `frontEnd/.../auth-token.interceptor.ts:8` | Dos pestañas refrescan a la vez y obtienen dos tokens válidos, o se revocan todas las sesiones. | `PESSIMISTIC_WRITE` en la rotación y período de gracia corto. |

### Severidad baja

| ID | Hallazgo | Evidencia | Corrección sugerida |
| :-- | :-- | :-- | :-- |
| CON-16 | El bloqueo del correlativo se mantiene durante una llamada remota | `finance-service/.../ComprobanteService.emitir` (l.54, l.89) | Validar el ingreso en efectivo antes de tomar el correlativo. |
| CON-17 | Se marca el comprobante en orders antes de guardar el pago | `PagoService.java:161`, `:260` | Compensar en el catch o marcar después del commit. |
| CON-18 | El scheduler no coordina instancias | `OrdenExpiracionScheduler.java:34` | ShedLock o `FOR UPDATE SKIP LOCKED`. |
| CON-19 | Si notification-service cae entre enviar y marcar ENVIADO, el mensaje se duplica (al menos una vez) | `notification-service/src/notifications/service.js:91-111` | Aceptado o deduplicar por id de evento. |

### Verificado sin problemas

- Orders: mesa, stock (orden fijo de bloqueo), ítems de comanda y transiciones con bloqueo; conflicto de versión → 409.
- Payments: `confirmar` y `actualizarEstadoDesdePasarela` bloquean la fila; existe `uq_pagos_orden_id`.
- Finance: correlativo con `pg_advisory_xact_lock`, `uq_arqueos_caja_abierta`, cierre de liquidación con `findByIdParaActualizar`, devolución idempotente por reclamo.
- Frontend: todos los `interval`/`setInterval` revisados se cancelan en `ngOnDestroy` y se pausan con la pestaña oculta.

---

## 4. Frontend (Angular)

Rutas relativas a `frontEnd/src/app/` salvo indicación. Verificados por muestreo: F1 y F3.

### Severidad alta

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| FE-01 | Recarga, apertura y cierre de liquidación de repartidor se pueden enviar dos veces | `features/cajero/cajero-dashboard.component.ts:960-979`, `:987-1012`, `:1037-1056`; botones en `cajero-recarga-fondo-modal.component.ts:110`, `cajero-nueva-liquidacion-modal.component.ts:101`, `cajero-cierre-liquidacion-modal.component.ts:72` | Con red lenta, un doble clic en "Confirmar Recarga" recarga el fondo dos veces; igual con aperturar y cerrar. | Activar `procesandoAccion` antes del `subscribe`, liberarlo en `next`/`error` y pasarlo como `[disabled]` a los tres modales. |
| FE-02 | El mozo puede duplicar una comanda con doble clic | `features/mozo/components/mozo-order-summary.component.ts:71`; `features/mozo/mozo-salon.component.ts:606-666` | Dos `createOrder` para la misma mesa: cocina prepara dos veces o el mozo ve un error confuso (falta confirmar si el backend bloquea la segunda orden). | Señal `enviandoComanda` que deshabilite el botón hasta `next`/`error`. |
| FE-03 | "Cobros del día" y "Total cobrado hoy" suman todos los pagos aprobados históricos | `features/cajero/cajero-dashboard.component.ts:429-447`, `:501-503`; `cajero-historial-tab.component.ts:50` | El total "de hoy" crece cada día, mezcla cobros online y no cuadra con el arqueo; además inventa cliente `'Cliente San Pollo'`, tipo `'DELIVERY'` y pone al cajero actual en todas las filas. | Filtrar por el día en America/Lima (o rango desde el backend) y no fabricar datos. |
| FE-04 | checkout-status usa el id de la orden como id de pago (por confirmar) | `features/client/checkout/checkout-status.component.ts:370`, `:272-274`; `checkout.component.ts:845`; `MercadoPagoGateway.java:143` | Sin `external_reference` en la URL, o abriendo `/checkout/success` directo, consulta `GET /pagos/{idOrden}`: puede mostrar aprobado el pago de otra orden. `sanpollo_last_order` nunca se limpia. | Guardar `ordenId` y `pagoId` por separado, consultar `GET /pagos/orden/{ordenId}` y limpiar al estado final. |
| FE-05 | Los errores de finanzas, feedback y reembolsos ocultan el motivo del backend | `cajero-dashboard.component.ts:976, 1010, 1054, 1066`; `features/admin/pages/feedback/admin-feedback.page.ts:180` leen `err.error.message`, pero los servicios responden `{"error": ...}` | El cajero ve "Http failure response…: 409 Conflict"; el admin siempre ve "Error en pasarela de pagos." | Usar `mensajeError(err, '…')` de `core/utils/api-error.ts`. |

### Severidad media

| ID | Hallazgo | Evidencia | Escenario de falla | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| FE-06 | Reintento de pago sobre una orden vieja aunque cambie el carrito | `features/client/checkout/checkout.component.ts:723-726`, `:777-781` | Falla el OTP de Yape, el cliente agrega un producto y reintenta: se cobra el total anterior y el producto nuevo no llega a cocina; al cambiar a tarjeta queda otra orden en PENDIENTE_PAGO. | Invalidar las órdenes pendientes al cambiar carrito, tipo de entrega o método, o comparar el total. |
| FE-07 | El carrito guarda precio y disponibilidad viejos y no respeta stock | `core/services/cart.service.ts:38-49`, `:91-111`; `product.adapter.ts:118` | El cliente ve S/36 y se le cobra S/40 sin aviso; pide 10 unidades con stock 2 y recibe un rechazo genérico. | Refrescar precios y stock al abrir el checkout, limitar cantidades y mostrar diferencias. |
| FE-08 | Pagos `REEMBOLSADO` y `REEMBOLSADO_PARCIAL` se muestran como `PENDIENTE` | `core/adapters/payment.adapter.ts:36-44`; `core/models/api-contracts.model.ts:176` | Tras un reembolso, checkout-status vuelve a "Pago en proceso" y el cajero ve el pago como pendiente de cobro. | Agregar los dos estados al contrato, al adapter y a las vistas. |
| FE-09 | Abrir caja y registrar movimiento desde Finanzas del admin: sin validación, sin bloqueo y con dos toasts | `features/admin/components/finanzas/cash-open-modal.component.ts:33`, `cash-movement-modal.component.ts:56`; `admin-finanzas.page.ts:132-142`; `core/services/finance.service.ts:74, 86` | Monto vacío o negativo se envía; `toFixed` sobre `null` lanza TypeError después de abrir la caja y el modal no cierra. | Validar `Number.isFinite(m) && m >= 0`, bandera de procesamiento, un solo toast y `mensajeError`. |
| FE-10 | Apertura de caja o de liquidación del cajero acepta monto vacío | `cajero-dashboard.component.ts:634`, `:993`; `cajero-arqueo-tab.component.ts:64`; `cajero-nueva-liquidacion-modal.component.ts:101` | `null < 0` es `false`: se envía `montoApertura: null`. | Exigir `Number.isFinite(v) && v >= 0` en botón y handler. |
| FE-11 | El modal de reclamo propone un reembolso inventado de S/15 | `features/admin/components/feedback/claim-resolution-modal.component.ts:239`, `:248` | En un reclamo sin monto se registra una devolución de S/15 que nadie pidió y aparece en la pestaña Devoluciones del cajero. | Dejar el monto vacío y obligatorio si hay reembolso, con tope al total de la orden. |
| FE-12 | Errores de carga se tragan y se muestran como "vacío" | `core/services/finance.service.ts:50-53`; `feedback.service.ts:382-386`; `payment.service.ts:33` | Si finance cae, el cajero ve "caja cerrada" y se le invita a abrir otra; si feedback cae, "sin devoluciones" aunque haya clientes esperando. | Estado de error separado del vacío, con aviso y reintento. |
| FE-13 | El cobro de salón trata un fallo de lectura como "sin pago previo" (por confirmar) | `core/services/payment.service.ts:69-75`; `features/cajero/services/cobro-salon.facade.ts:46-56` | Un timeout en la lectura de un reintento podría iniciar un segundo pago para la misma orden. | Propagar los errores distintos de 404 en vez de convertirlos en `null`. |

### Severidad baja

| ID | Hallazgo | Evidencia | Corrección sugerida |
| :-- | :-- | :-- | :-- |
| FE-14 | `guestGuard` manda MOZO y REPARTIDOR a `/admin` y luego ven "No tienes permisos" | `core/guards/guest.guard.ts` | Reutilizar `ROLE_HOME` de `role.guard.ts`. |
| FE-15 | El adapter de órdenes inventa valores: estado desconocido → `'PAGADO'` (accionable en cocina), `createdAt = new Date()` | `core/adapters/order.adapter.ts:24`, `:48`, `:135-136`, `:172` | Estado `DESCONOCIDO` no accionable; no fabricar fechas. |
| FE-16 | Id de orden ilegible termina siendo la orden 1 (`parseInt(...) \|\| 1`) | `core/services/payment.service.ts` (varias funciones), `core/adapters/payment.adapter.ts:71`, `checkout.component.ts:743, 834` | Rechazar ids que no sean enteros positivos. |
| FE-17 | El estado de éxito de checkout-status puede volver a "pendiente" porque el polling sigue | `checkout-status.component.ts:278-286`, `:345-346` | Cancelar el polling al confirmar el éxito. |
| FE-18 | Código muerto y dependencias sin uso: `loadKitchenOrders`, `@lucide/angular`, `lucide-angular`, `dayjs`; nombre inventado `Usuario #{id}` en movimientos | `core/services/orders.service.ts:387`; `package.json`; `finance.service.ts:100` | Eliminar o usar. |
| FE-19 | Los entornos temporales afectan también `authApiUrl`, `paymentsApiUrl` y `appBaseUrl`, no solo `ordersApiUrl` | `src/environments/environment.ts` | Volver a URLs estables o variables de build. |

### Huecos de pruebas

Sin specs: `cart.service.ts`, los guards (`role`, `client`, `guest`), `feedback.service.ts` (devoluciones y reembolsos), `cajero-devoluciones-tab`, `claim-resolution-modal`, `mozo-order-summary` (doble envío) y `payment.adapter` (estados de reembolso). `cajero-recarga-fondo-modal.component.spec.ts` no cubre el doble envío.

---

## 5. Configuración, despliegue, esquema y pruebas

Rutas relativas a `polleria/` salvo indicación. Verificados en el código: CFG-01 y CFG-02. No se transcribe ningún secreto.

**Corrección a un pendiente anterior:** `docker-compose.local.yml:183` ya entrega `INTERNAL_API_KEY` a feedback-service.

### Severidad crítica

| ID | Hallazgo | Evidencia | Escenario | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CFG-01 | Contraseña de aplicación de Gmail versionada como valor de respaldo | Secreto en `docker-compose.local.yml:74` (`${MAIL_PASSWORD:-…}`), en la historia desde `5942ecd` (2026-08-23); correo personal como respaldo en la línea 73; también en `auth-service/src/main/resources/application-local.properties:30`, que está en `.gitignore` pero entra en la imagen (CFG-09) | Cualquiera con el repo o la imagen envía correos desde esa cuenta (2FA falsos, phishing). | Revocar la contraseña en Google, quitar los respaldos y limpiar la historia. |

### Severidad alta

| ID | Hallazgo | Evidencia | Escenario | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CFG-02 | Inicializadores `@Transactional` con `catch` impiden el arranque en vez de seguir | `payments-service/.../config/InicializadorIndicesUnicos.java:37-43`, `InicializadorEstadoPago.java:52-84`; `orders-service/.../config/InicializadorIndicesUnicos.java:37-75` | Con datos duplicados heredados, Hibernate marca la transacción rollback-only, el commit lanza `UnexpectedRollbackException` y el servicio entra en bucle de reinicio; además se revierten las sentencias posteriores. Falta una prueba que lo reproduzca. | `JdbcTemplate` con autocommit por sentencia, como `InicializadorIndicesFinanzas`. |
| CFG-03 | El script de Cloud Run publica secretos en texto plano | `deploy-gcp-cloudrun.ps1:70-78` (Secret Manager sin usar), `:121-145` (`--set-env-vars` con `DB_PASSWORD`, `JWT_SECRET`, `MAIL_PASSWORD` e impresión con `Write-Host`, también en DryRun) | Los secretos quedan en consola, historial y en la revisión de Cloud Run visible para el rol Viewer. | `--set-secrets` con Secret Manager y no imprimir valores. |
| CFG-04 | Cloud Run despliega un sistema incompleto y con URLs a localhost | `deploy-gcp-cloudrun.ps1:125-137`; `cloudbuild.yaml:8-42` (solo auth, orders y payments); faltan `INTERNAL_API_KEY`, `ORDERS_SERVICE_URL`, `NOTIFICATION_*`, `MINIO_*`, `AUTH_SERVICE_URL`, `INCIDENT_SERVICE_URL` | payments llama a `http://localhost:8082`, la autenticación entre servicios falla cerrada y la subida de imágenes falla. | Completar servicios y variables, o documentar el alcance parcial. |
| CFG-05 | El build de producción del frontend apunta a túneles efímeros | `frontEnd/src/environments/environment.ts:3-19` (`*.trycloudflare.com`); `frontEnd/vercel.json` sin reglas para `/feedback`, `/finanzas`, `/incidentes`, `/notificaciones` | Al reiniciar el túnel, la app desplegada queda rota sin cambiar código. | Dominios estables y rutas relativas detrás de las reescrituras de Vercel. |
| CFG-06 | No hay CI y las pruebas de base de datos se saltan en silencio | `.github/` sin workflows; `cloudbuild.yaml:5` con `-DskipTests`; 25 clases con `Assumptions.assumeTrue(postgresDisponible())` (p. ej. `CanalOrigenTest.java:100, 259-265`); ningún compose crea `polleria_test` | Sin el contenedor en 5433, `mvn test` sale en verde sin ejecutar las pruebas de integración. | Workflow con Postgres y `polleria_test`, y que la falta de base falle la suite (`-Drequire.db=true`). |

### Severidad media

| ID | Hallazgo | Evidencia | Escenario | Corrección sugerida |
| :-- | :-- | :-- | :-- | :-- |
| CFG-07 | CHECK de enums sin realinear en tablas existentes (por confirmar según la fecha de cada tabla) | `ddl-auto=update` crea el CHECK solo con la columna; solo se realinean `ordenes.estado`, `pagos.estado` y `movimientos_caja.categoria`; `Role.CAJERO` (`5b31df4`) y `Categoria.POLLO_A_LA_BRASA` (`e460de1`) se agregaron después; `InicializadorEstadoPago.java:46-47` repite los valores a mano; `pagos.metodo_pago` no se realinea | En una base anterior, crear un cajero o un producto de esa categoría viola el CHECK. | Inicializador genérico que reconstruya el CHECK desde `Enum.values()` para cada `@Enumerated`. |
| CFG-08 | Reconstrucción del CHECK no atómica o repetida en cada arranque | `orders-service/.../InicializadorEstadoOrdenCheck.java:51-53` (DROP y ADD separados); `finance-service/.../InicializadorIndicesFinanzas.java` y `InicializadorEstadoPago.java:71-79` (en cada arranque, con lock ACCESS EXCLUSIVE) | Si el ADD falla, la tabla queda sin CHECK con solo un `log.error`; cada arranque bloquea y revalida la tabla. | Un único `ALTER TABLE … DROP …, ADD …` y solo cuando falte un valor. |
| CFG-09 | Imágenes Docker no reproducibles y con archivos locales | Todos los Dockerfile Java copian `target/*.jar` del host (p. ej. `orders-service/Dockerfile:3`); `auth/application.properties:61` y `orders/application.properties:49` fuerzan `spring.profiles.active=local` | `docker compose build` empaqueta un jar viejo (causa probable de la "imagen vieja") y mete los `application-local.properties` ignorados por git, con secretos. | Dockerfile multi-stage con `mvn package` y sin `spring.profiles.active` fijo. |
| CFG-10 | Valores por defecto de Mercado Pago incoherentes | `MercadoPagoWebhookController.java:197-198` con secreto vacío por defecto (`application.properties:69`); `mercadopago.sandbox=true` por defecto (`:70`) con clave pública de producción (`:67` y `environment.ts`) | En producción sin secreto se aceptan notificaciones sin firma (mitigado por la verificación de `40c663c`); la mezcla sandbox + producción tiene efecto por confirmar. | Fallar cerrado sin secreto cuando `sandbox=false` y defaults coherentes. |
| CFG-11 | El WebSocket acepta cualquier origen y no autentica | `orders-service/.../WebSocketConfig.java:21-23` (`*`); `SecurityConfig.java:68` (`/ws-polleria/**` en `permitAll`); sin `ChannelInterceptor` | Cualquier sitio se suscribe a `/topic/salon/mesas` y `/topic/cocina/nuevas-comandas` y ve comandas en tiempo real. | Mismos orígenes permitidos y validación del JWT en el CONNECT de STOMP. |
| CFG-12 | Credenciales de MinIO por defecto en el código | `feedback/MinioConfig.java:26-29`, `orders/MinioConfig.java:24-27`, `orders/application.properties:38-39`, `payments/MinioConfig.java:37-38`, `notification-service/src/config.js:90-91` | Sin la variable, el servicio se conecta en silencio con credenciales por defecto o a localhost. | Quitar defaults y validar al arrancar. |

### Severidad baja

| ID | Hallazgo | Evidencia | Corrección sugerida |
| :-- | :-- | :-- | :-- |
| CFG-13 | Contenedores como root, sin `HEALTHCHECK` ni límites de memoria; Chromium con `--no-sandbox` como root | Los 7 Dockerfile; `notification-service/src/whatsapp/client.js:15`; Cloud Run con 512Mi (`deploy-gcp-cloudrun.ps1:87`) | Usuario no root, `HEALTHCHECK` y `-XX:MaxRAMPercentage`. |
| CFG-14 | URLs por defecto incoherentes en orders | `orders/application.properties:65` (`finance.service.url` con 8086, sin uso); `SancionDispatcherService.java:32` (default 8087 para incident) | Eliminar la propiedad muerta y alinear defaults. |
| CFG-15 | Dependencias sin uso o sin fijar | `h2` en `payments-service/pom.xml:85-89`; `lucide-angular`, `@lucide/angular`, `dayjs` en el frontend; `whatsapp-web.js` en `github:…#main` | Eliminar y fijar el commit. |
| CFG-16 | Compose de desarrollo expuesto en todas las interfaces | Postgres (5432/5433), pgAdmin con credenciales triviales versionadas y `latest`, MinIO (9000/9001); contraseña de BD dentro de `DATABASE_URL` | Publicar en `127.0.0.1` y fijar versiones. |
| CFG-17 | Plantillas de variables incompletas | `.env.production.example` sin `INTERNAL_API_KEY`, `NOTIFICATION_API_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_SANDBOX`, `MINIO_*`; `orders-service/.env.example` sin `INTERNAL_API_KEY` | Completarlas. |
| CFG-18 | Sin pruebas de integración en feedback, finance e incident | Sin `application-test.properties` ni `@SpringBootTest` | Al menos una prueba de arranque de contexto por servicio contra `polleria_test`. |

**Esquema compartido:** no hay dos servicios que mapeen la misma tabla; notification-service solo usa `conversation_state` y `notification_log`.

---

