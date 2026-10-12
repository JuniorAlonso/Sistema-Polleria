# Resumen de avance — 11/10/2026 (Junior Alonso)

## 1. Fase 3 — Notificaciones por WhatsApp ✅ (en `main`)

**notification-service**
- Cola FIFO con 10 s entre mensajes para evitar baneos (RNF10), con reintentos y recuperación al reiniciar.
- Endpoints: `/api/notificaciones/whatsapp/{pago,estado,codigo}`, `/historial` (solo ADMIN) y `/status`.
- Historial de envíos guardado en PostgreSQL (RF32). Mensajes con tono formal y sin emojis.
- Dockerfile, `.env.example` y tests con `node:test`.
- Se quitó del repo la sesión de WhatsApp (`.wwebjs_auth`); ahora está en `.gitignore`.
- **Fix Windows (EBUSY):** al cerrarse la sesión, el reinicio entraba en bucle ("The browser is already running"). Ahora cierra el navegador, borra la sesión y muestra un QR nuevo.

**Vincular WhatsApp desde el panel admin**
- `GET /api/notificaciones/qr` (solo ADMIN) devuelve el QR generado en el servidor.
- La pestaña WhatsApp del panel muestra el QR si no hay sesión y se actualiza cada 5 s.

**orders-service**
- Avisos de cambio de estado solo para pedidos DELIVERY (RF31).
- Número de pedido por cliente (N.° 1, 2, 3…) en lugar del ID interno.
- Seguimiento sin cuenta con código de 4 dígitos enviado por WhatsApp.
- `GET /ordenes/{id}` solo para el dueño, el personal o servicios con `X-Internal-Key`.

**payments-service**
- Aviso por WhatsApp de pago confirmado para pedidos DELIVERY (RF30).

**auth-service y frontend**
- El login devuelve el celular; el checkout pide el celular para WhatsApp.
- Registro: muestra requisitos de la contraseña y botón para verla.
- Panel admin conectado al historial real de WhatsApp.
- Seguimiento con verificación por celular; se eliminó el pedido falso que aparecía cuando fallaba el backend.

## 2. Fase 5 — Pagos con Mercado Pago 🟡 (rama `feat/fase5-mercadopago-pedido-real`)

Retomé lo que se había avanzado y corregí:
- **Compilación:** faltaba el import de `PaymentClient` en `MercadoPagoGateway`; payments-service no compilaba.
- **Pedido real:** el checkout crea el pedido **antes** de ir a Mercado Pago y la preferencia usa su ID real. Si el cliente vuelve sin pagar y reintenta, se reutiliza el mismo pedido.
- Se valida que la orden exista antes de crear la preferencia.
- **Aviso a orders-service (RF21):** se enviaba `nuevoEstado` (el DTO espera `estado`) y el webhook no tenía JWT. Ahora va `estado` + `X-Internal-Key`, y `PATCH /ordenes/{id}/estado` acepta la clave interna.
- **Seguridad:** se eliminó el Access Token del frontend y el proxy `/mp-api`. Las credenciales ahora van en `polleria/payments-service/.env` (no se sube a git).

> ⚠️ **Importante:** el Access Token anterior estuvo publicado en el repo. Su dueño debe **renovarlo** en el panel de Mercado Pago.

**Pendiente** (detalle en `_docs/fases/fase_5_pagos_mercadopago/README.md`, §10):
1. Páginas de retorno `/checkout/success|failure|pending`.
2. Propagar rechazo/cancelación del pago a orders-service (RNF09).
3. Proteger `POST /pagos/mercadopago/preferencia` con JWT (hoy está en `permitAll`).
4. Unificar el cálculo del total en backend (envío S/ 6 y descuentos no coinciden).
5. Evitar el `Pago` duplicado al iniciar con TARJETA.
6. Reembolsos: no marcar `REEMBOLSADO` si MP falla; distinguir parcial de total.
7. Webhook en local: usar ngrok o el despliegue.
8. Quitar `spring.profiles.active=local` de `application.properties`.
9. Tests con Java 21 (con Java 25 Mockito falla) y pruebas E2E con tarjetas de prueba.

## 3. Otros
- Logo de San Pollo como favicon e íconos de la app (192/512 y apple-touch-icon); título "San Pollo de Ica" y página en español.
