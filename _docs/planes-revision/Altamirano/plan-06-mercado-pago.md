# Plan de Revisión 6: Finalización de Mercado Pago en la Web

**Responsable:** por asignar
**Servicios:** `payments-service` (8083), `orders-service` (8082), `frontEnd` (`/checkout`, seguimiento, `/admin/ordenes`), despliegue (Cloud Run, Vercel)
**Tablas:** `pagos`, `ordenes`, `productos` (sin cambios de esquema)
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Dejar operativo el cobro con **Mercado Pago Checkout Pro** en el checkout web, desde la creación del pedido hasta la confirmación del pago, incluidos fallos, reintentos y despliegue.

**Estado actual:** la base existe (SDK Java 2.1.28, preferencia con monto tomado de la orden, webhook con consulta a la API, páginas de retorno con polling), pero un pago real no puede completarse en producción.

### Bloqueantes, en orden

| # | Bloqueante | Evidencia |
| :-- | :--- | :--- |
| 1 | Faltan variables `MERCADOPAGO_*`, `ORDERS_SERVICE_URL` e `INTERNAL_API_KEY` en compose y deploy. | `docker-compose.local.yml`, `deploy-gcp-cloudrun.ps1` |
| 2 | `back_urls` con `localhost` por defecto. La documentación indica no usar dominios locales. | `MercadoPagoGateway`, `application.properties` |
| 3 | El checkout prioriza `sandboxInitPoint`, también en producción. | `checkout.component.ts` |
| 4 | Si falla el aviso a orders, el pago queda aprobado, la orden se cancela a los 15 minutos y el error se pierde. | `NotificadorOrden`, webhook |
| 5 | La preferencia no expira: se puede pagar una orden ya cancelada. | `MercadoPagoGateway`, `OrdenExpiracionScheduler` |
| 6 | Un `rejected` tardío degrada un pago aprobado. `CANCELADO→APROBADO` lanza una excepción que se pierde. | `PagoService` |
| 7 | "Reintentar" crea otra orden. Hay una ventana de 800 ms para un doble envío. | `checkout-status`, `checkout.component.ts` |
| 8 | No hay forma de recuperar un webhook perdido. | — |

### Yape simulado (mock temporal)

`POST /pagos/yape-otp` **se mantiene como mock por el momento, hasta que el responsable lo reemplace.** No llama a Mercado Pago ni mueve dinero: es público y aprueba cualquier código de 6 dígitos distinto de `000000`, con lo que la orden pasa a cocina. Sirve para demostraciones y pruebas; no debe ofrecerse a clientes reales mientras siga siendo un mock.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D6.1 | Se usa Checkout Pro con redirección. No se incorporan Bricks ni Checkout API. | Ya está integrado, y Mercado Pago captura los datos de tarjeta. |
| D6.2 | El checkout web mantiene sus tres opciones: **Mercado Pago**, **Yape** (mock) y **Efectivo contra entrega**. Los medios dentro de Mercado Pago dependen de la cuenta. | Yape dentro de Checkout Pro no pudo confirmarse para esta cuenta. |
| D6.3 | `YAPE_OTP` se conserva como mock y este Plan no lo modifica. Su reemplazo queda a cargo del responsable. | Decisión del equipo. El Yape con captura del bot tampoco cambia. |
| D6.4 | Una preferencia por orden. Si `pagos.checkout_url` existe y la orden sigue en `PENDIENTE_PAGO`, se reutiliza. | Hoy cada llamada crea otra preferencia pagable, lo que permite doble cobro. |
| D6.5 | La preferencia expira a los **13 minutos** desde la creación de la orden, con `expires` y `expiration_date_to`. | Debe vencer antes que el scheduler de 15 minutos. |
| D6.6 | `binary_mode=true` y exclusión de `ticket` y `atm`. | El pago se resuelve al instante, dentro de la ventana de la orden. |
| D6.7 | El backend devuelve una única `checkoutUrl`, según `MERCADOPAGO_SANDBOX`. | El frontend no decide el ambiente. |
| D6.8 | El webhook avisa a orders de forma **síncrona**. Un fallo transitorio responde 5xx para que Mercado Pago reintente. | `@Async` pierde el error y puede no terminar en Cloud Run. |
| D6.9 | Un `approved` repetido reenvía el aviso si la orden sigue en `PENDIENTE_PAGO`. | Cubre el reintento, que hoy se ignora. El reenvío del Plan 2 en `confirmar` no lo alcanza. |
| D6.10 | Solo `approved` y reembolsos cambian un pago `APROBADO`. | Evita la degradación por notificaciones desordenadas. |
| D6.11 | Un `approved` sobre una orden terminal registra el pago y dispara el **reembolso total automático**. | La orden ya repuso el stock y no puede revivirse. El cliente no debe quedar cobrado sin pedido. |
| D6.12 | Se valida `transaction_amount` contra `pago.monto` y moneda `PEN`. Si no coincide, no se confirma y queda el detalle. | Hoy no se verifica. |
| D6.13 | La firma se valida con el secreto del panel. En producción, sin secreto el webhook rechaza todo. Comparación en tiempo constante. | Hoy, sin secreto, acepta cualquier notificación. |
| D6.14 | La URL del webhook se configura en **Tus integraciones**, no por preferencia. | Es el camino documentado para la firma. Queda sin confirmar si `notification_url` llega firmada. |
| D6.15 | `POST /pagos/{id}/sincronizar` consulta Mercado Pago y aplica el resultado con la lógica existente. | Recupera webhooks perdidos sin tablas nuevas, y sirve en local sin túnel. |
| D6.16 | El checkout con Mercado Pago sigue exigiendo sesión. | Comportamiento actual de la UI. |
| D6.17 | "Reintentar" usa la misma orden. "Cambiar método" cancela la orden con el flujo existente y vuelve al checkout. | Evita órdenes duplicadas y stock retenido. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿De dónde sale el monto? | De la orden, con estado y total validados. | Correcto; certificar. |
| ¿Qué pasa sin token? | La preferencia lanza `RuntimeException` y responde 500. | Mensaje claro y error de configuración al arrancar en producción. |
| ¿Se puede perder el reintento de Mercado Pago? | Sí: toda excepción responde 200. | Matriz de la sección 5. |
| ¿`merchant_order` afecta? | `data.id` se usa sin mirar `type`. | Ignorar lo que no sea `payment`. |
| ¿Qué pasa si el usuario vuelve antes del webhook? | Polling de 60 s con `GET /pagos/{id}`. | Al agotarse, llama a `sincronizar`. |
| ¿La página de resultado confía en la URL? | No, la usa solo como pista. | Correcto; certificar. |
| ¿El carrito se conserva si falla? | Sí, solo se limpia con éxito confirmado. | Correcto; certificar. |
| ¿`/failure` con pago pendiente? | Se muestra como pendiente. | Mostrar el fallo; sincronizar al abrir. |
| ¿El bot usa Mercado Pago? | No, usa Yape manual con captura. | Sin cambios. |
| ¿Se ve la referencia en el panel? | Solo en cajero. | Agregarla en Admin. |
| ¿Quedan restos sin uso? | SDK JS en `index.html`, public key, `CheckoutResultComponent`. | Eliminarlos. |

---

## 4. Flujo de datos

| # | Paso | Frontend | Backend | BD / Mercado Pago |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Crear orden | `checkout`: `isProcessing` activo hasta navegar | `POST /ordenes` | `ordenes` (`PENDIENTE_PAGO`), `orden_items`, `productos.stock` |
| 2 | Preferencia | `crearPreferenciaMercadoPago` | `POST /pagos/mercadopago/preferencia`: valida orden y monto; reutiliza o crea | `pagos` (`PENDIENTE`, `checkout_url`); MP `POST /checkout/preferences` |
| 3 | Pagar | Redirección a `checkoutUrl` | — | Checkout Pro |
| 4 | Notificar | — | `POST /pagos/webhook/mercadopago`: firma, tipo, consulta del pago | MP `GET /v1/payments/{id}` |
| 5 | Aplicar | — | Valida monto y moneda, aplica la matriz | `pagos.estado`, `referencia_externa`, `detalle` |
| 6 | Avisar | — | `PATCH /ordenes/{id}/estado` con `X-Internal-Key`, síncrono | `ordenes.estado=RECIBIDO` |
| 7 | Retornar | `checkout-status`: polling de `GET /pagos/{id}`; `sincronizar` al agotarse | `POST /pagos/{id}/sincronizar` | Lectura |
| 8 | Resultado | Éxito: limpia carrito y va a seguimiento. Fallo: reintentar o cambiar método | — | — |

**Pedido expirado (paso 5):** orders rechaza la transición por orden terminal → reembolso total con `PagoService.reembolsar` → `detalle` explica la devolución → 200.

---

## 5. Matriz del webhook

| Situación | Efecto en `pagos` | Aviso a orders | HTTP |
| :--- | :--- | :--- | :--- |
| Firma inválida | Ninguno | — | 401 |
| `type` distinto de `payment` | Ninguno | — | 200 |
| Error de API de MP, de BD o de orders (transitorio) | Sin confirmar | — | **5xx** |
| `external_reference` sin pago | Ninguno, log | — | 200 |
| Monto o moneda no coinciden | Sin cambio de estado, `detalle` | — | 200 |
| `approved` desde `PENDIENTE` o `RECHAZADO` | `APROBADO` | `RECIBIDO` | 200 |
| `approved` desde `CANCELADO` | `APROBADO` (transición nueva, solo pasarela) | `RECIBIDO` o D6.11 | 200 |
| `approved` repetido | Sin cambio | Reenvía si sigue `PENDIENTE_PAGO` | 200 |
| `approved` sobre `REEMBOLSADO` o `REEMBOLSADO_PARCIAL` | Sin cambio | — | 200 |
| `approved` con orden terminal | `APROBADO` y luego reembolso | — | 200 |
| `pending`, `in_process` | `PENDIENTE`, nunca sobre `APROBADO` | — | 200 |
| `rejected`, `cancelled` | `RECHAZADO` o `CANCELADO`, nunca sobre `APROBADO`; la orden sigue viva para reintentar | — | 200 |
| `refunded` | `REEMBOLSADO`; no cancela una orden entregada | Solo si no está entregada | 200 |
| `charged_back`, `in_mediation` | Sin cambio de estado, `detalle` visible | — | 200 |

---

## 6. Cambios por capa

### Base de datos

Sin cambios de esquema. Se usan `pagos.estado`, `referencia_externa`, `detalle` y `checkout_url`.

### Backend (`payments-service`)

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `MercadoPagoGateway.crearPreferencia` | D6.4, D6.5, D6.6, `statement_descriptor`, `checkoutUrl` según ambiente, sin `notification_url` en producción. | Corregir |
| `OrdenesClient.OrdenInfo` | Agrega `creadoEn`, ya disponible en `OrdenResponse`. | Corregir |
| `MercadoPagoWebhookController` | Matriz de la sección 5, D6.13, secreto obligatorio en producción, sin registrar el HMAC ni el body completo. | Corregir |
| `PagoService.actualizarEstadoDesdePasarela` | D6.10, D6.12, D6.11 y `CANCELADO→APROBADO` solo por pasarela. | Corregir |
| `NotificadorOrden` | Variante síncrona que propaga el error. El `@Async` sigue para los demás flujos. | Corregir |
| `POST /pagos/{id}/sincronizar` | Staff o dueño. Busca por `external_reference` y aplica el resultado. | Nuevo |
| `PaymentClient`, `PreferenceClient` | Se inyectan como beans para poder probarlos. | Corregir |
| `MercadoPagoConfiguration` | Con `SANDBOX=false`, falla al arrancar si faltan token o secreto. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `checkout.component.ts` | En la rama de tarjeta usa `checkoutUrl` y mantiene `isProcessing` y la orden pendiente hasta navegar. La rama `YAPE_OTP` no cambia. | Corregir |
| `checkout-status.component.ts` | "Reintentar" con la misma orden, "Cambiar método", `sincronizar` al abrir `/failure` y al agotar el polling, resuelve `RECIBIDO` sin `pagoId`. | Corregir |
| `payments-api.service.ts`, `payment.service.ts` | Agrega `sincronizar` y adapta `checkoutUrl`. | Corregir |
| `admin-ordenes.page.ts` | Referencia de Mercado Pago, detalle y botón "Sincronizar". | Corregir |
| `index.html`, `environment*.ts`, `CheckoutResultComponent` | Elimina SDK JS, public key y componente sin ruta. | Corregir |

### Configuración y despliegue

| Variable | Local | Producción |
| :--- | :--- | :--- |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial de prueba | `--set-secrets` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Del panel de la app de prueba | `--set-secrets` |
| `MERCADOPAGO_SANDBOX` | `true` | `false` |
| `MERCADOPAGO_SUCCESS_URL`, `_FAILURE_URL`, `_PENDING_URL` | URL del túnel al frontend | Dominio HTTPS de Vercel |
| `ORDERS_SERVICE_URL`, `INTERNAL_API_KEY` | Compose | Cloud Run |

- **Webhook en el panel de Mercado Pago:** `https://<host>/pagos/webhook/mercadopago`, con el evento **Pagos**.
- **Local:** dos túneles `cloudflared`, a `:8083` para el webhook y a `:4200` para el retorno.
- **Producción:** el webhook apunta directo a Cloud Run.
- `deploy-gcp-cloudrun.ps1` debe inyectar el secreto que ya lista y las variables de la tabla. `cloudbuild.yaml` no cambia.

---

## 7. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R6.1 | Mock de Yape sin regresión | El flujo `YAPE_OTP` del checkout y los tests `procesarYapeOtp` se comportan igual que antes de este Plan. |
| R6.2 | Pago aprobado | Con cuenta de prueba: redirige a Mercado Pago, paga, vuelve, la orden pasa a `RECIBIDO`, aparece en KDS y el carrito se limpia. |
| R6.3 | Preferencia | Dos llamadas sobre la misma orden devuelven la misma URL. Expira a los 13 minutos. |
| R6.4 | Pago rechazado | La orden sigue viva. "Reintentar" no crea otra orden. |
| R6.5 | Cambiar método | La orden se cancela, se repone el stock y se vuelve al checkout. |
| R6.6 | Firma | Sin firma válida: 401. Producción sin secreto: el servicio no arranca. |
| R6.7 | Reintentos | Con orders caído el webhook responde 5xx. Al reintentar, la orden pasa a `RECIBIDO` una sola vez. |
| R6.8 | Orden expirada | Un `approved` sobre orden cancelada queda registrado, se reembolsa una vez y el detalle lo explica. |
| R6.9 | Orden de eventos | `rejected` después de `approved` no cambia el estado. |
| R6.10 | Integridad | Un `transaction_amount` distinto no confirma el pago. |
| R6.11 | Sincronización | Sin webhook, `sincronizar` aprueba el pago y avanza la orden. Un cliente ajeno recibe 403. |
| R6.12 | Ambiente | Con `SANDBOX=false`, la URL devuelta es `init_point`. |
| R6.13 | Doble envío | Dos clics rápidos crean una sola orden. |
| R6.14 | Producción | Un pago real de bajo monto se completa y se reembolsa desde el Admin. |

---

## 8. Orden de implementación

1. **Configuración:** variables, túneles y credenciales de prueba.
2. **Webhook y estados:** sección 5, D6.8 a D6.13.
3. **Preferencia:** D6.4 a D6.7.
4. **Frontend** y `sincronizar`.
5. **Prueba de punta a punta** con cuentas de prueba, y luego el despliegue.

---

## 9. Contratos con otros planes

- **Recibe de Plan 4:** `PagoService.reembolsar` con D4.6 y D4.7, para D6.11 y la devolución desde Admin. Este Plan toma los cambios del webhook que antes figuraban en el Plan 4.
- **Recibe de Plan 3:** el control de dueño en `GET /pagos` (D3.7), que `sincronizar` reutiliza.
- **Plan 3:** es dueño del POS. Este Plan no toca el cobro presencial. Plan 3 solo pide corregir el desglose de IGV en `checkout.component`.
- **Plan 2:** su reenvío en `confirmar` sigue siendo necesario para el flujo manual.

---

## 10. Alcance

**Incluye:** Checkout Pro web, webhook, estados, reintentos, sincronización y despliegue.

**No incluye:** reemplazo del mock `YAPE_OTP` (D6.3), Bricks o Checkout API, Yape nativo con token, pagos dentro del bot, suscripciones, compra como invitado, contracargos automatizados, comprobante del delivery prepagado (Plan 3).

**Por confirmar al configurar la cuenta:** medios disponibles en Perú, y tarjetas y usuarios de prueba del panel.

---

## 11. Verificación

```bash
cd polleria
./mvnw test -pl payments-service "-Dtest=MercadoPagoWebhookControllerTest,PreferenciaMercadoPagoInvitadoTest,PagoServiceTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/client/checkout/**/*.spec.ts" --include="src/app/core/services/payment.service.spec.ts"
```

**Tests a actualizar o crear:** los casos `procesarYapeOtp` de `PagoServiceTest` se conservan; agregar por cada fila de la matriz; campos de la preferencia y su reutilización; fallo del aviso a orders; `sincronizar`; elección de URL; y, en frontend, reintento y doble envío.

**Fuentes:** [Webhooks y firma](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks), [URLs de retorno](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/checkout-customization/user-interface/redirection), [Crear preferencia](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/create-preference/post).
