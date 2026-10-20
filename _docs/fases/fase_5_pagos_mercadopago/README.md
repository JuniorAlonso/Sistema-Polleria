# 💳 FASE 5 — Pasarela de Pagos Real: Mercado Pago (`payments-service`)

**Objetivo:** Integrar la pasarela de pagos oficial de **Mercado Pago** (Checkout Pro, SDK y Webhooks IPN) en el `payments-service` existente, reemplazando los gateways mock de desarrollo por cobros reales con tarjetas, Yape y billeteras digitales.

**Prioridad:** Media — Integración externa independiente asignada a compañero de equipo.

> ⚠️ **Fase Independiente:** Esta fase es autocontenida y puede desarrollarse, probarse y desplegarse de forma independiente por un miembro del equipo. El `payments-service` de Fase 1 ya funciona con mocks; esta fase agrega la integración real sin romper el flujo existente.

---

## 1. Arquitectura de Integración

```
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│ Frontend (Angular)   │        │         payments-service (:8083)        │
│ :4200                │        │                                         │
│                      │        │  ┌───────────────────────────────────┐   │
│ Checkout Pro SDK ────┼──MP───►│  │   PaymentGatewayService          │   │
│ (Botón de pago)      │        │  │   (Strategy Pattern)             │   │
│                      │        │  └────────┬──────────────────────────┘   │
└──────────────────────┘        │           │                              │
                                │  ┌────────┼──────────┬──────────────┐   │
                                │  ▼        ▼          ▼              ▼   │
                                │ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐ │
                                │ │Contra│ │Tarjta│ │Yape  │ │MercadoP │ │
                                │ │entrega│ │Mock │ │Mock  │ │Gateway  │ │
                                │ │      │ │(Dev) │ │(Dev) │ │(REAL)   │ │
                                │ └──────┘ └──────┘ └──────┘ └────┬────┘ │
                                │                                  │      │
                                └──────────────────────────────────┼──────┘
                                                                   │
                                            ┌──────────────────────┼───────┐
                                            │ Mercado Pago API             │
                                            │ - Checkout Pro               │
                                            │ - Webhooks IPN               │
                                            │ - SDK Java (mercadopago-sdk) │
                                            └──────────────────────────────┘
```

| Componente | Tecnología | Rol |
| :--- | :---: | :--- |
| `MercadoPagoGateway` | Spring Boot + SDK Mercado Pago | Crear preferencias de pago y procesar webhooks |
| `MercadoPagoWebhookController` | Spring Boot REST | Recibir notificaciones IPN de Mercado Pago |
| Checkout Pro | SDK Frontend JS | Botón de pago embebido en el checkout Angular |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx). Los siguientes requerimientos ya tienen implementación base en Fase 1 (mocks y contraentrega). Esta fase **amplía** la implementación con la pasarela real:

| Código | Tipo | Descripción Oficial | Implementación Fase 1 | Ampliación Fase 5 |
| :--- | :---: | :--- | :--- | :--- |
| **RF19** | RF | Métodos de pago: contraentrega, tarjeta o monederos digitales. | `CONTRAENTREGA` operativo + `TARJETA`/`YAPE_PLIN` mock | Cobro real vía Mercado Pago Checkout Pro |
| **RF20** | RF | Registro de transacciones con estado. | `EstadoPago` completo | Webhook actualiza estado desde pasarela real |
| **RF21** | RF | Actualización automática del estado del pedido según pasarela. | Feign/REST a `orders-service` | Webhook IPN dispara la actualización automática |
| **RNF03** | RNF | Comunicación cifrada y validación de webhooks. | JWT + HTTPS | Validación HMAC/firma de webhooks Mercado Pago |
| **RNF09** | RNF | Registro automático de cancelaciones de pago por pasarela. | Manejo manual/mock | Evento `payment.cancelled`/`payment.rejected` desde IPN |

---

## 3. Dependencia Maven

```xml
<!-- pom.xml de payments-service -->
<dependency>
    <groupId>com.mercadopago</groupId>
    <artifactId>sdk-java</artifactId>
    <version>2.1.28</version>
</dependency>
```

### 3.1 SDK de MinIO (comprobantes de Yape — T6c, S7)

```xml
<!-- pom.xml de payments-service -->
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.17</version>
</dependency>
```

`payments-service` **no sube ni descarga** el comprobante (eso es T6b, en el notification-service):
el cliente MinIO existe solo para firmar la **URL presignada de vida corta** que ve el `ADMIN` al
verificar un pago por Yape. El bucket queda privado y la clave del objeto no se expone a otros roles.
La firma SigV4 es local (la región del cliente se fija en `us-east-1`, la de MinIO por defecto), así
que no se necesita MinIO levantado para generar la URL. Si el SDK no se puede descargar de Maven
Central, la tarea se reporta como bloqueo en vez de firmar SigV4 a mano.

---

## 4. Implementación del Gateway Mercado Pago

### 4.1 Clase `MercadoPagoGateway` (`payments-service`)
Implementado en `com.sistema.polleria.payments.gateway.MercadoPagoGateway` (implementa la interfaz `PaymentGateway`):

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoPagoGateway implements PaymentGateway {

    private final PagoRepository pagoRepository;

    @Value("${mercadopago.webhook.url:}")       private String webhookUrl;
    @Value("${mercadopago.back-urls.success:}") private String successUrl;
    @Value("${mercadopago.back-urls.failure:}") private String failureUrl;
    @Value("${mercadopago.back-urls.pending:}") private String pendingUrl;
    @Value("${mercadopago.sandbox:true}")       private boolean sandbox;

    @Override
    public boolean supports(MetodoPago metodoPago) {
        return metodoPago == MetodoPago.TARJETA || metodoPago == MetodoPago.YAPE_PLIN;
    }

    @Override
    @Transactional
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        PreferenceResponse pref = crearPreferencia(request, clienteId);
        String redirectUrl = sandbox
                ? (pref.sandboxInitPoint() != null ? pref.sandboxInitPoint() : pref.initPoint())
                : pref.initPoint();
        return new GatewayResult(EstadoPago.PENDIENTE, pref.preferenceId(),
                "Checkout Pro generado. Redirigir a pasarela Mercado Pago", redirectUrl);
    }

    @Transactional
    public PreferenceResponse crearPreferencia(IniciarPagoRequest request, Long clienteId) {
        // 1. Reutiliza el Pago de la orden; si ya esta APROBADO, lanza IllegalStateException (409)
        Optional<Pago> pagoExistente = pagoRepository.findByOrdenId(request.ordenId());
        Pago pago = pagoExistente.orElseGet(Pago::new);
        pago.setOrdenId(request.ordenId());
        pago.setClienteId(clienteId);
        pago.setMonto(request.monto());
        pago.setMetodoPago(request.metodoPago() != null ? request.metodoPago() : MetodoPago.TARJETA);
        pago.setEstado(EstadoPago.PENDIENTE);
        pago = pagoRepository.save(pago);

        // 2. Item del pedido (PEN) + back URLs con respaldo a localhost:4200/checkout/*
        PreferenceRequest.PreferenceRequestBuilder preferenceBuilder = PreferenceRequest.builder()
                .items(List.of(PreferenceItemRequest.builder()
                        .id(String.valueOf(request.ordenId()))
                        .title("Pedido #" + request.ordenId() + " - El San Pollo")
                        .description("Consumo en restaurante / polleria")
                        .quantity(1).currencyId("PEN").unitPrice(request.monto()).build()))
                .backUrls(PreferenceBackUrlsRequest.builder()
                        .success(safeSuccessUrl).failure(safeFailureUrl).pending(safePendingUrl).build())
                .autoReturn("approved")
                .externalReference(String.valueOf(pago.getId()));  // vincula la preferencia con el pago local
        if (webhookUrl != null && !webhookUrl.isBlank()) {
            preferenceBuilder.notificationUrl(webhookUrl);
        }

        // 3. El Access Token viene de la configuracion global (MercadoPagoConfiguration)
        Preference preference = new PreferenceClient().create(preferenceBuilder.build());

        pago.setReferenciaExterna(preference.getId());
        pago.setDetalle("Preferencia Mercado Pago generada: " + preference.getId());
        pago.setCheckoutUrl(redirectUrl);
        pagoRepository.save(pago);

        return new PreferenceResponse(preference.getId(), preference.getInitPoint(),
                preference.getSandboxInitPoint(), pago.getId(), request.ordenId());
    }
}
```

Detalles del contrato real: el titulo del item es `Pedido #<ordenId> - El San Pollo`, la moneda es `PEN`, se envia `autoReturn("approved")` y el `notificationUrl` solo se agrega si `mercadopago.webhook.url` tiene valor. La preferencia **reutiliza** el `Pago` de la orden y responde `409` si esa orden ya tiene un pago `APROBADO`.

### 4.2 Controlador de Webhooks IPN (`MercadoPagoWebhookController`)

Implementado en `com.sistema.polleria.payments.controller.MercadoPagoWebhookController`:

```java
@Slf4j
@RestController
@RequestMapping("/pagos/webhook")
@RequiredArgsConstructor
public class MercadoPagoWebhookController {

    @RequestMapping(value = "/mercadopago", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Void> handleWebhook(
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "id", required = false) String paramId,
            @RequestParam(value = "data.id", required = false) String dataId,
            @RequestHeader(value = "x-signature", required = false) String xSignature,
            @RequestBody(required = false) Map<String, Object> body) {

        // 1. Valida la firma HMAC (x-signature + x-request-id) contra mercadopago.webhook.secret
        // 2. Resuelve el paymentId (data.id, id o cuerpo) y consulta la API de Mercado Pago
        // 3. Traduce el externalReference al pagoId local y aplica la transicion:
        switch (payment.getStatus()) {
            case "approved" -> {
                if (pago.getEstado() != EstadoPago.APROBADO) {   // idempotente: no reconfirma
                    pagoService.confirmar(pagoId, req, "");
                }
            }
            case "rejected" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.RECHAZADO, detalle);
                pagoService.notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "");
            }
            case "cancelled" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.CANCELADO, detalle);
                pagoService.notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "");
            }
            case "refunded" -> {
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.REEMBOLSADO, detalle);
                pagoService.notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "");
            }
            case "in_process", "pending" -> {
                // actualizarEstadoDesdePasarela ignora degradar un pago ya APROBADO a PENDIENTE
                pagoService.actualizarEstadoDesdePasarela(pagoId, EstadoPago.PENDIENTE, detalle);
            }
        }
        return ResponseEntity.ok().build();
    }
}
```

Notas sobre el contrato real:

- Los cambios de estado pasan por `PagoService.actualizarEstadoDesdePasarela`, que toma el pago con bloqueo pesimista (`buscarConBloqueo`) y **preserva** `APROBADO` frente a un `in_process` tardio.
- `rejected`, `cancelled` y `refunded` **si propagan** a `orders-service` (avisan `CANCELADO` con `X-Internal-Key`), cubriendo RNF09.
- La validacion de firma usa `x-signature` + `x-request-id` con `MERCADOPAGO_WEBHOOK_SECRET` (HMAC SHA-256). Si falta la cabecera se registra una advertencia; con el secreto vacio no hay firma que verificar.

---

## 5. Endpoints de Mercado Pago

### 5.1 Crear Preferencia de Mercado Pago
```
POST /pagos/mercadopago/preferencia
```
**Acceso:** 🔒 `CLIENTE`, `MOZO`, `ADMIN` (Bearer JWT)

**Request Body (`IniciarPagoRequest`):**
```json
{
  "ordenId": 42,
  "monto": 84.50,
  "metodoPago": "TARJETA"
}
```

**Response `201 Created` (`PreferenceResponse`):**
```json
{
  "preferenceId": "123456789-abcd-ef01-2345-6789abcdef01",
  "initPoint": "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=123456789-abcd",
  "sandboxInitPoint": "https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=123456789-abcd",
  "pagoId": 15,
  "ordenId": 42
}
```

### 5.2 Webhook IPN
```
POST /pagos/webhook/mercadopago
GET  /pagos/webhook/mercadopago
```
**Acceso:** 🔓 Público (llamado directamente por los servidores de Mercado Pago).  
Recibe parámetros `data.id` / `id` o payload JSON, consulta a la API de Mercado Pago vía SDK y actualiza el pago a `APROBADO` o `RECHAZADO`, propagando el estado hacia `orders-service` (RF21).

### 5.3 Reembolsos (RF29)
```
POST /pagos/{id}/reembolso
POST /pagos/orden/{ordenId}/reembolso
```
**Acceso:** 🔒 Solo `ADMIN` (`hasAnyAuthority('ADMIN','ROLE_ADMIN')`)

**Request Body:**
```json
{
  "monto": 15.00,
  "motivo": "Producto faltante en pedido - Reclamo #8"
}
```

**Acción:** ejecuta `PaymentClient.refund()` en Mercado Pago y registra la reversión. Solo se permite sobre un pago `APROBADO` o `REEMBOLSADO_PARCIAL`; el resultado marca `REEMBOLSADO_PARCIAL` si el monto es menor al total y `REEMBOLSADO` si es total. Un fallo de la pasarela **no** se silencia: el estado no se marca como reembolsado si Mercado Pago rechaza la operación.

---

## 6. Integración en Frontend (Angular)

### 6.1 Botón de Checkout Pro

El checkout **crea primero la orden real** en `orders-service` (estado `PENDIENTE_PAGO`), guarda `{ id, code, total }` en `localStorage('sanpollo_last_order')` y recién entonces pide la preferencia; la redirección usa el punto de entrada de sandbox cuando existe:

```typescript
// checkout.component.ts → payWithMercadoPago()
const pref = await firstValueFrom(
  this.paymentService.crearPreferenciaMercadoPago(ordenReal.id, ordenReal.total)
);
const redirectUrl = pref.sandboxInitPoint || pref.initPoint;
window.location.href = redirectUrl;
```

`PaymentService.crearPreferenciaMercadoPago(ordenId, monto)` llama a `POST /pagos/mercadopago/preferencia` y devuelve `{ preferenceId, initPoint, sandboxInitPoint, pagoId, ordenId }`. `confirmOrder()` deriva a `payWithMercadoPago()` cuando el método es `TARJETA`, de modo que no se crean dos pagos para la misma orden.

> ⚠️ **Failover de 3 tiers (deuda conocida):** el método está envuelto en un `catchError` con dos respaldos. **TIER 2** llama directo a `https://api.mercadopago.com/checkout/preferences` desde el navegador usando un *access token* embebido en `environment.ts`, proxeado por `/mp-api` (`frontEnd/proxy.conf.json`); **TIER 3** simula una preferencia local (`mock=true`) para contingencia offline. El TIER 2 expone credenciales en el bundle del cliente y debe eliminarse.

### 6.2 Página de Retorno (Back URLs)
| URL | Estado MP | Acción en Frontend |
| :--- | :--- | :--- |
| `/checkout/success` | Pago aprobado | Muestra confirmación y redirige a tracking |
| `/checkout/failure` | Pago rechazado | Muestra error y opción de reintentar |
| `/checkout/pending` | Pago pendiente | Muestra estado de espera con polling |

---

## 7. Variables de Entorno

```properties
# payments-service (:8083) — Variables de Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=                       # Vacío por defecto. Si está vacío (o contiene "TU_ACCESS_TOKEN") se usan los mocks
MERCADOPAGO_PUBLIC_KEY=APP_USR-XXXX             # Clave pública (hay un valor real por defecto en application.properties)
MERCADOPAGO_WEBHOOK_URL=                        # URL completa del webhook IPN
MERCADOPAGO_NOTIFICATION_URL=                   # Alternativa; se usa si la anterior falta
MERCADOPAGO_WEBHOOK_SECRET=                     # Secreto para validar la firma HMAC (x-signature)
MERCADOPAGO_SANDBOX=true                        # true = usa sandboxInitPoint, false = initPoint
MERCADOPAGO_SUCCESS_URL=http://3.237.70.97/checkout/success  # valor por defecto del repo
MERCADOPAGO_FAILURE_URL=http://3.237.70.97/checkout/failure
MERCADOPAGO_PENDING_URL=http://3.237.70.97/checkout/pending
NOTIFICATION_URL=http://localhost:3001          # notifications WhatsApp (RF30)
NOTIFICATION_API_KEY=                           # X-Internal-Key hacia notification-service
INTERNAL_API_KEY=                              # X-Internal-Key hacia orders-service. Sin default: si falta, la llamada se rechaza. Debe coincidir con orders-service.
MINIO_ENDPOINT=localhost                        # Debe ser alcanzable por el navegador del panel (localhost:9000 está mapeado por el compose); `minio` no resuelve desde el navegador
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin                     # credenciales de desarrollo
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=polleria-comprobantes
MINIO_URL_EXPIRACION_SEGUNDOS=300               # vida de la URL firmada que ve el ADMIN

# Variables existentes de Fase 1 (se mantienen)
DB_URL=jdbc:postgresql://localhost:5432/polleria
DB_USERNAME=postgres
DB_PASSWORD=********
JWT_SECRET=<clave-secreta-compartida-min-256-bits>
ORDERS_SERVICE_URL=http://localhost:8082
```

---

## 8. Patrón Strategy Completo

```
                 ┌───────────────────────────┐
                 │   PaymentGatewayService   │
                 │   (Selecciona gateway)    │
                 └─────────────┬─────────────┘
                               │ supports(metodoPago)
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
┌───────────────────────┐ ┌───────────────────┐ ┌────────────────────┐
│   MercadoPagoGateway  │ │ ContraentregaGw   │ │  Mock Gateways     │
│   (Checkout Pro, IPN) │ │ (Efectivo manual) │ │  (Solo desarrollo) │
│                       │ │                   │ │                    │
│ TARJETA ──────────────│ │ CONTRAENTREGA     │ │ TARJETA (dev)      │
│ YAPE_PLIN ────────────│ │                   │ │ YAPE_PLIN (dev)    │
└───────────────────────┘ └───────────────────┘ └────────────────────┘
```

**Selección automática (`PaymentGatewayService.seleccionar`):** `CONTRAENTREGA` va siempre a `ContraentregaGateway`. Para `TARJETA` y `YAPE_PLIN` el servicio lee `mercadopago.access-token`: si está presente, no está en blanco y no contiene el texto `TU_ACCESS_TOKEN`, se enruta a `MercadoPagoGateway` (real); en caso contrario se usan los mocks `TarjetaGateway` / `YapePlinGateway`. El flag `MERCADOPAGO_SANDBOX` no decide el enrutamiento: solo elige `sandboxInitPoint` o `initPoint` dentro del gateway real.

---

## 9. Guía de Pruebas para el Equipo

### 9.1 Configuración de Sandbox
1. Crear cuenta de desarrollador en [Mercado Pago Developers](https://www.mercadopago.com.pe/developers).
2. Generar credenciales de **Sandbox** (Access Token y Public Key).
3. Configurar las variables de entorno con las credenciales de sandbox.
4. Usar las [tarjetas de prueba de Mercado Pago](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).

### 9.2 Pruebas Funcionales
| Caso | Entrada | Resultado Esperado |
| :--- | :--- | :--- |
| Crear preferencia | `POST /pagos/mercadopago/preferencia` con `TARJETA` | `201` con `{ preferenceId, initPoint, sandboxInitPoint, pagoId, ordenId }` |
| Orden con pago ya aprobado | Misma orden, segunda preferencia | `409` (`IllegalStateException`) |
| Pago aprobado | Webhook `approved` | Pago → `APROBADO` (idempotente) y notificación WhatsApp si es delivery |
| Pago rechazado | Webhook `rejected` | Pago → `RECHAZADO` **y** orden → `CANCELADO` vía `X-Internal-Key` |
| Pago cancelado | Webhook `cancelled` | Pago → `CANCELADO` y orden → `CANCELADO` |
| Pago reembolsado por MP | Webhook `refunded` | Pago → `REEMBOLSADO` y orden → `CANCELADO` |
| Webhook `in_process` tardío | Webhook `in_process` sobre un pago `APROBADO` | No degrada a `PENDIENTE` |
| Firma inválida | `x-signature` que no coincide | Se registra advertencia y no se aplica el cambio |
| Reembolso | `POST /pagos/{id}/reembolso` como `ADMIN` | Reversa en MP + `REEMBOLSADO` o `REEMBOLSADO_PARCIAL` |
| Contraentrega (F1) | `POST /pagos` con `CONTRAENTREGA` | Funciona igual que en Fase 1 (sin cambios) |
| Mock fallback | `MERCADOPAGO_ACCESS_TOKEN` vacío | `TARJETA`/`YAPE_PLIN` usan los mocks de Fase 1 |
| Verificación de Yape (T6c) | `POST /pagos/{id}/verificar` con `ADMIN` y `{ "aprobado": true }` | `200` con pago `APROBADO`, `verificadoPor`/`verificadoEn`, y la orden avanza a `EN_PREPARACION` |
| Rechazo de Yape (T6c) | `POST /pagos/{id}/verificar` con `ADMIN` y `{ "aprobado": false, "motivoRechazo": "..." }` | `200` con pago `RECHAZADO`; la orden no avanza |
| Rechazo sin motivo (T6c) | `{ "aprobado": false }` | `400` y el pago no cambia |
| Verificación de otro rol (T6c) | `POST /pagos/{id}/verificar` con `CAJERO` o sin token | `403`/`401` y el pago no cambia |
| URL firmada del comprobante (T6c) | `GET /pagos/orden/{ordenId}` con `ADMIN` | `comprobanteUrl` presignada (5 min); con otro rol, sin `comprobanteClave` ni `comprobanteUrl` |

### 9.3 Criterios de Aceptación
- [ ] El botón de Checkout Pro redirige correctamente a Mercado Pago.
- [ ] El webhook IPN actualiza el estado del pago y del pedido automáticamente.
- [ ] Las tarjetas de prueba de sandbox funcionan correctamente.
- [ ] Los pagos contraentrega de Fase 1 siguen funcionando sin cambios.
- [ ] Sin variables de Mercado Pago, el sistema funciona con mocks (retrocompatibilidad).
- [ ] Los reembolsos se procesan correctamente vía la API de Mercado Pago.
