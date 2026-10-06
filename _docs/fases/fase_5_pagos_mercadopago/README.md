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
    <version>2.1.24</version>
</dependency>
```

---

## 4. Implementación del Gateway Mercado Pago

### 4.1 Clase `MercadoPagoGateway` (`payments-service`)
Implementado en `com.sistema.polleria.payments.gateway.MercadoPagoGateway`:

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoPagoGateway {

    private final PagoRepository pagoRepository;

    @Value("${mercadopago.webhook.url}")
    private String webhookUrl;

    @Value("${mercadopago.back-urls.success}")
    private String successUrl;

    @Value("${mercadopago.back-urls.failure}")
    private String failureUrl;

    @Value("${mercadopago.back-urls.pending}")
    private String pendingUrl;

    @Transactional
    public PreferenceResponse crearPreferencia(IniciarPagoRequest request, Long clienteId) {
        // 1. Obtener o registrar entidad Pago en estado PENDIENTE
        Optional<Pago> pagoExistente = pagoRepository.findByOrdenId(request.ordenId());
        Pago pago = pagoExistente.orElseGet(() -> {
            Pago p = new Pago();
            p.setOrdenId(request.ordenId());
            p.setClienteId(clienteId);
            p.setMonto(request.monto());
            p.setMetodoPago(MetodoPago.TARJETA);
            p.setEstado(EstadoPago.PENDIENTE);
            return p;
        });
        pago = pagoRepository.save(pago);

        // 2. Construir ítem y Back URLs
        PreferenceItemRequest itemRequest = PreferenceItemRequest.builder()
                .id(String.valueOf(request.ordenId()))
                .title("Pedido #" + request.ordenId() + " - El San Pollo")
                .quantity(1)
                .currencyId("PEN")
                .unitPrice(request.monto())
                .build();

        PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                .success(successUrl)
                .failure(failureUrl)
                .pending(pendingUrl)
                .build();

        // 3. Vincular externalReference con el ID del pago local
        PreferenceRequest preferenceRequest = PreferenceRequest.builder()
                .items(List.of(itemRequest))
                .backUrls(backUrls)
                .notificationUrl(webhookUrl)
                .externalReference(String.valueOf(pago.getId()))
                .build();

        PreferenceClient client = new PreferenceClient();
        Preference preference = client.create(preferenceRequest);

        pago.setReferenciaExterna(preference.getId());
        pagoRepository.save(pago);

        return new PreferenceResponse(
                preference.getId(),
                preference.getInitPoint(),
                preference.getSandboxInitPoint(),
                pago.getId(),
                pago.getOrdenId()
        );
    }
}
```

### 4.2 Controlador de Webhooks IPN (`MercadoPagoWebhookController`)
Implementado en `com.sistema.polleria.payments.controller.MercadoPagoWebhookController`:

```java
@Slf4j
@RestController
@RequestMapping("/pagos/webhook")
@RequiredArgsConstructor
public class MercadoPagoWebhookController {

    private final PagoRepository pagoRepository;
    private final PagoService pagoService;

    @RequestMapping(value = "/mercadopago", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<Void> handleWebhook(
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "topic", required = false) String topic,
            @RequestParam(value = "id", required = false) String paramId,
            @RequestParam(value = "data.id", required = false) String dataId,
            @RequestBody(required = false) Map<String, Object> body) {

        String paymentId = resolvePaymentId(type, topic, paramId, dataId, body);
        if (paymentId != null) {
            PaymentClient client = new PaymentClient();
            Payment payment = client.get(Long.parseLong(paymentId));

            if (payment.getExternalReference() != null) {
                Long pagoId = Long.parseLong(payment.getExternalReference());
                var optPago = pagoRepository.findById(pagoId);

                if (optPago.isPresent()) {
                    Pago pago = optPago.get();
                    if ("approved".equalsIgnoreCase(payment.getStatus())) {
                        if (pago.getEstado() != EstadoPago.APROBADO) {
                            ConfirmarPagoRequest req = new ConfirmarPagoRequest(
                                    "MP-" + paymentId,
                                    "Pago aprobado por Mercado Pago (Medio: " + payment.getPaymentMethodId() + ")"
                            );
                            pagoService.confirmar(pagoId, req, "");
                        }
                    } else if ("rejected".equalsIgnoreCase(payment.getStatus())) {
                        pago.setEstado(EstadoPago.RECHAZADO);
                        pago.setDetalle("Pago rechazado por Mercado Pago: " + payment.getStatusDetail());
                        pagoRepository.save(pago);
                    }
                }
            }
        }
        return ResponseEntity.ok().build();
    }
}
```

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
```
**Acceso:** 🔒 Solo `ADMIN`

**Request Body:**
```json
{
  "monto": 15.00,
  "motivo": "Producto faltante en pedido - Reclamo #8"
}
```

**Acción:** Ejecuta `PaymentClient.refund()` en Mercado Pago y registra la reversión.

---

## 6. Integración en Frontend (Angular)

### 6.1 Botón de Checkout Pro
```typescript
// checkout.component.ts
async iniciarPagoMercadoPago() {
  const response = await this.pagoService.crearPago({
    ordenId: this.orden.id,
    monto: this.orden.total,
    metodoPago: 'TARJETA'
  });

  if (response.checkoutUrl) {
    // Redirigir al Checkout Pro de Mercado Pago
    window.location.href = response.checkoutUrl;
  }
}
```

### 6.2 Página de Retorno (Back URLs)
| URL | Estado MP | Acción en Frontend |
| :--- | :--- | :--- |
| `/checkout/success` | Pago aprobado | Muestra confirmación y redirige a tracking |
| `/checkout/failure` | Pago rechazado | Muestra error y opción de reintentar |
| `/checkout/pending` | Pago pendiente | Muestra estado de espera con polling |

---

## 7. Variables de Entorno

```properties
# payments-service (:8083) — Variables adicionales para Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-XXXX-XXXX-XXXX  # Token de producción o sandbox
MERCADOPAGO_PUBLIC_KEY=APP_USR-XXXX               # Para el SDK frontend
MERCADOPAGO_NOTIFICATION_URL=https://api.sanpollo.pe  # URL base para webhooks IPN
MERCADOPAGO_SANDBOX=true                            # true = sandbox, false = producción

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

**Selección automática:** Si `MERCADOPAGO_SANDBOX != null`, los métodos `TARJETA` y `YAPE_PLIN` se enrutan al gateway real. Si no hay configuración de Mercado Pago, se usa el mock gateway (retrocompatible con Fase 1).

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
| Crear preferencia | `POST /pagos` con `TARJETA` | 201 con `checkoutUrl` de Mercado Pago |
| Pago aprobado | Webhook con `status: approved` | Pago → `APROBADO`, Orden avanza en estado |
| Pago rechazado | Webhook con `status: rejected` | Pago → `RECHAZADO`, Orden mantiene estado |
| Pago cancelado | Webhook con `status: cancelled` | Pago → `CANCELADO` |
| Reembolso | `POST /pagos/{id}/reembolso` | Reversa en MP + registro en BD |
| Contraentrega (F1) | `POST /pagos` con `CONTRAENTREGA` | Funciona igual que en Fase 1 (sin cambios) |
| Mock fallback | Sin variables MP configuradas | Funciona igual que en Fase 1 (mocks) |

### 9.3 Criterios de Aceptación
- [ ] El botón de Checkout Pro redirige correctamente a Mercado Pago.
- [ ] El webhook IPN actualiza el estado del pago y del pedido automáticamente.
- [ ] Las tarjetas de prueba de sandbox funcionan correctamente.
- [ ] Los pagos contraentrega de Fase 1 siguen funcionando sin cambios.
- [ ] Sin variables de Mercado Pago, el sistema funciona con mocks (retrocompatibilidad).
- [ ] Los reembolsos se procesan correctamente vía la API de Mercado Pago.
