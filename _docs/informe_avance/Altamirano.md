# 💳 Fase 5 — Cambios Realizados: Integración Mercado Pago

**Commit:** `103229c` — `fase05-mercado-pago`  
**Autor:** xxsebas15xx  
**Fecha:** 12 de octubre de 2026  
**Archivos modificados:** 16 (572 adiciones, 105 eliminaciones)

---

## 📋 Resumen Ejecutivo

Se completó la integración de punta a punta de Mercado Pago Checkout Pro, corrigiendo los 5 puntos pendientes identificados en la revisión de código de la Fase 5:

1. Vinculación del pago con un pedido real (eliminación del ID temporal)
2. Implementación de páginas de retorno (`success`, `failure`, `pending`)
3. Propagación de rechazos/cancelaciones a `orders-service` con autenticación inter-servicio
4. Corrección de la diferencia de montos (costo de envío S/ 6.00)
5. Eliminación de pagos duplicados al pagar con tarjeta
6. Protección del endpoint de preferencia con JWT y `@PreAuthorize`

---

## 🔧 Cambios por Archivo

### Frontend (`frontEnd`)

#### 1. `checkout.component.ts` — Flujo de pago corregido
**Archivo:** [checkout.component.ts](file:///c:/Users/Sebastián/Sistema-Polleria/frontEnd/src/app/features/client/checkout/checkout.component.ts)

- **Eliminado `tempOrderId`**: Ya no se genera un ID temporal aleatorio (`Date.now() % 1000000`). Ahora se crea la orden real en `orders-service` **antes** de solicitar la preferencia de Mercado Pago.
- **Flujo corregido de `payWithMercadoPago()`:**
  1. Valida dirección y celular (9 dígitos, empieza con 9)
  2. Crea la orden real en `orders-service` con estado `PENDIENTE_PAGO`
  3. Guarda `{ id, code, total }` en `localStorage('sanpollo_last_order')`
  4. Solicita la preferencia con el `ordenId` real
  5. Redirige a `sandboxInitPoint` o `initPoint`
- **Eliminación de pagos duplicados:** `confirmOrder()` ahora redirige a `payWithMercadoPago()` si el método es `TARJETA`, evitando crear dos pagos para la misma orden.
- **Lectura de parámetros de retorno:** Se importó `ActivatedRoute` para leer `?status=failure` y `?status=pending` en `ngOnInit()`, mostrando notificaciones al usuario.
- **Estado de contraentrega:** El mensaje de éxito indica "Pagas al repartidor en efectivo al recibir tu pedido" cuando la orden es contraentrega.

#### 2. `checkout-status.component.ts` — NUEVO: Páginas de retorno de MP
**Archivo:** [checkout-status.component.ts](file:///c:/Users/Sebastián/Sistema-Polleria/frontEnd/src/app/features/client/checkout/checkout-status.component.ts) *(358 líneas)*

Componente standalone que maneja las 3 rutas de retorno de Mercado Pago:

| Ruta | Comportamiento |
|------|---------------|
| `/checkout/success` | Lee orden de `localStorage`, muestra confirmación con cuenta regresiva, redirige a `/tracking?code=POL-X` |
| `/checkout/failure` | Muestra detalle del rechazo de MP, botón para reintentar |
| `/checkout/pending` | Polling reactivo cada 3 segundos a `GET /pagos/{pagoId}`. Al aprobarse, redirige a tracking |

#### 3. `app.routes.ts` — Rutas de retorno registradas
**Archivo:** [app.routes.ts](file:///c:/Users/Sebastián/Sistema-Polleria/frontEnd/src/app/app.routes.ts)

```typescript
{ path: 'checkout/success', component: CheckoutStatusComponent },
{ path: 'checkout/failure', component: CheckoutStatusComponent },
{ path: 'checkout/pending', component: CheckoutStatusComponent },
```

#### 4. `payment.service.ts` — Limpieza de seguridad
**Archivo:** [payment.service.ts](file:///c:/Users/Sebastián/Sistema-Polleria/frontEnd/src/app/core/services/payment.service.ts)

- **Eliminado** el Access Token hardcodeado en el frontend
- **Eliminado** el fallback "Plan B" que llamaba directamente a la API de MP desde el navegador
- **Agregado** método `obtener(pagoId)` para consultar pagos por ID (usado por el polling en pending)

---

### Backend — `orders-service`

#### 5. `JwtAuthFilter.java` — Autenticación inter-servicio
**Archivo:** [JwtAuthFilter.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/orders-service/src/main/java/com/sistema/polleria/orders/filter/JwtAuthFilter.java)

- **Agregado:** Verificación del header `X-Internal-Key` que coincida con `${internal.api-key:}`
- Cuando la clave es válida, establece un principal autenticado con rol `ADMIN` en el `SecurityContextHolder`
- Permite que `payments-service` llame a `PATCH /ordenes/{id}/estado` sin JWT de usuario

#### 6. `ActualizarEstadoRequest.java` — Compatibilidad de payload
**Archivo:** [ActualizarEstadoRequest.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/orders-service/src/main/java/com/sistema/polleria/orders/dto/ActualizarEstadoRequest.java)

- **Agregado:** `@JsonAlias("nuevoEstado")` y `@JsonProperty("estado")` para aceptar ambos nombres de campo en el JSON de entrada

#### 7. `Orden.java` — Costo de envío en el total
**Archivo:** [Orden.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/orders-service/src/main/java/com/sistema/polleria/orders/entity/Orden.java)

- **Agregada constante:** `COSTO_DELIVERY = new BigDecimal("6.00")`
- **Corregido `recalcularTotal()`:** Si `tipo == DELIVERY` y hay ítems, suma S/ 6.00 al subtotal de productos. Esto resuelve la diferencia entre el monto cobrado al cliente en Mercado Pago y el total guardado en la base de datos.

---

### Backend — `payments-service`

#### 8. `SecurityConfig.java` — Endpoint de preferencia protegido
**Archivo:** [SecurityConfig.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/config/SecurityConfig.java)

- **Removido:** `/pagos/mercadopago/**` de `permitAll()`
- **Solo público:** `/pagos/webhook/**` (para que MP pueda llamar al webhook)
- Todos los demás endpoints requieren JWT

#### 9. `PagoController.java` — Autorización por roles
**Archivo:** [PagoController.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/controller/PagoController.java)

- **Agregado:** `@PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN')")` en `crearPreferenciaMercadoPago()`

#### 10. `MercadoPagoWebhookController.java` — Notificación de rechazos/cancelaciones
**Archivo:** [MercadoPagoWebhookController.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/controller/MercadoPagoWebhookController.java)

- **Agregado:** Los estados `rejected`, `cancelled` y `refunded` ahora ejecutan `pagoService.notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "")` para propagarlos a `orders-service`

#### 11. `PagoService.java` — Comunicación segura y reembolsos mejorados
**Archivo:** [PagoService.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/service/PagoService.java)

- **Inyección de** `${orders.service.internal-key}` para autenticación inter-servicio
- **`notificarOrdenEstadoAsync()`** envía header `X-Internal-Key` y payload con campos `estado` y `nuevoEstado` (compatibilidad)
- **`reembolsar()`**: Ya no silencia excepciones de `mercadoPagoGateway.procesarReembolso()`. Distingue reembolso total (`REEMBOLSADO`) vs parcial (`REEMBOLSADO_PARCIAL`)

#### 12. `MercadoPagoGateway.java` — Back URLs y auto-return
**Archivo:** [MercadoPagoGateway.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/gateway/MercadoPagoGateway.java)

- **Actualizadas** las URLs de retorno por defecto a `/checkout/success`, `/checkout/failure`, `/checkout/pending`
- **Agregado:** `.autoReturn("approved")` en la `PreferenceRequest` para que MP redirija automáticamente al aprobar

#### 13. `EstadoPago.java` — Nuevo estado
**Archivo:** [EstadoPago.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/entity/EstadoPago.java)

- **Agregado:** `REEMBOLSADO_PARCIAL` al enum

#### 14. `MercadoPagoConfiguration.java` — Arranque sin token
**Archivo:** [MercadoPagoConfiguration.java](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/java/com/sistema/polleria/payments/config/MercadoPagoConfiguration.java)

- **Cambiado:** `@Value("${mercadopago.access-token:}")` con valor por defecto vacío para no fallar si no se configura (usa mock gateways)

#### 15. `application.properties` — Tokens y configuración
**Archivo:** [application.properties](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/src/main/resources/application.properties)

- Tokens de MP actualizados con las credenciales renovadas
- Back URLs actualizadas a `/checkout/success`, `/checkout/failure`, `/checkout/pending`
- Webhook URL soporta tanto `MERCADOPAGO_WEBHOOK_URL` como `MERCADOPAGO_NOTIFICATION_URL`

#### 16. `.env.example` — Credenciales renovadas
**Archivo:** [.env.example](file:///c:/Users/Sebastián/Sistema-Polleria/polleria/payments-service/.env.example)

- Tokens actualizados con las nuevas credenciales de Mercado Pago

---

## ✅ Criterios de Aceptación (README §9.3)

| Criterio | Estado |
|----------|--------|
| El botón de Checkout Pro redirige correctamente a Mercado Pago | ✅ Implementado |
| El webhook IPN actualiza el estado del pago y del pedido automáticamente | ✅ Con HMAC + notificación a orders-service |
| Las tarjetas de prueba de sandbox funcionan correctamente | ⏳ Requiere prueba en ejecución |
| Los pagos contraentrega de Fase 1 siguen funcionando sin cambios | ✅ `ContraentregaGateway` intacto |
| Sin variables de Mercado Pago, el sistema funciona con mocks | ✅ Token vacío = mock gateways |
| Los reembolsos se procesan correctamente vía la API de Mercado Pago | ✅ Con `REEMBOLSADO_PARCIAL` |

---

## 📊 Estadísticas del Commit

| Métrica | Valor |
|---------|-------|
| Archivos modificados | 16 |
| Líneas agregadas | 572 |
| Líneas eliminadas | 105 |
| Archivos nuevos | 1 (`checkout-status.component.ts`) |
| Servicios afectados | `frontEnd`, `orders-service`, `payments-service` |
