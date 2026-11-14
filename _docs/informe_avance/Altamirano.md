# 💳 Fase 5 — Integración Mercado Pago: Resumen de Cambios y Avance

**Autor:** Sebastián Altamirano (`xxsebas15xx`)  
**Rama:** `feature/fase05-mercado-pago` / `main`  
**Fecha de actualización:** 13 de noviembre de 2026  
**Servicios afectados:** `payments-service`, `orders-service`, `frontEnd`, infraestructura Docker

---

## 📋 Resumen de cambios — Parte de Sebastián

### Backend (2 microservicios + Infraestructura)

#### payments-service
- **Integración oficial Checkout Pro (Orders API):** Generación de órdenes de pago con `POST /v1/orders` en la API oficial de Mercado Pago, utilizando llave de idempotencia (`X-Idempotency-Key`), configuración de back-URLs (`/checkout/success`, `/checkout/failure`, `/checkout/pending`) y redirección automática al aprobarse con `config.online.auto_return = "approved"`.
- **Procesamiento de pagos 100% automático:** Webhook nativo en `POST /pagos/webhook/mercadopago` con soporte de eventos de Orders API (`type: order`, `action: order.processed`) y pagos unitarios (`payment`), acreditando en la base de datos el estado `APROBADO` sin requerir validación ni autorización manual humana.
- **Endpoint de retorno y confirmación:** Implementación de `GET /pagos/mercadopago/retorno` para verificar la transacción devuelta por la pasarela, vincular la referencia externa (`MP-...`) y asegurar la confirmación del pedido.
- **Catálogo de medios de pago:** Implementación de `GET /pagos/mercadopago/medios-pago` mediante `PaymentMethodClient.list()`, retornando los medios de pago disponibles y activos (tarjetas de crédito, débito y monederos digitales).
- **Seguridad y Control de Acceso (RBAC):** `POST /pagos/mercadopago/preferencia` protegido con JWT (`@PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN')")`), ligando la transacción al `clienteId` autenticado. Webhook público con validación criptográfica HMAC (`x-signature` + `MERCADOPAGO_WEBHOOK_SECRET`).
- **Idempotencia y Bloqueo Pesimista:** Bloqueo a nivel de fila (`buscarConBloqueo`) para evitar condiciones de carrera entre la redirección del navegador y el webhook IPN. Un pago ya `APROBADO` no se re-procesa ni se degrada ante un evento `in_process` tardío.
- **Gestión de ciclo de vida y reembolsos (RF29):** Soporte para eventos `rejected`, `cancelled` y `refunded`. Endpoint administrativo `POST /pagos/{id}/reembolso` con llamada a `PaymentClient.refund()`, distinguiendo entre `REEMBOLSADO` total y `REEMBOLSADO_PARCIAL`.
- **Estrategia y Fallback transparente:** Patrón Strategy en `PaymentGatewayService`: si no se detectan credenciales de Mercado Pago, conmuta automáticamente a los gateways mock para no alterar el entorno de desarrollo local.

#### orders-service
- **Autenticación inter-servicio segura:** `JwtAuthFilter` adaptado para validar cabecera `X-Internal-Key` (`${internal.api-key}`), permitiendo a `payments-service` actualizar el estado de los pedidos sin requerir token JWT de usuario.
- **Avance automático de pedidos a cocina:** Actualización automática del pedido de `PENDIENTE_PAGO` a `RECIBIDO` apenas el pago es confirmado por Mercado Pago, ingresando de inmediato a la cola de preparación sin intervención de cajero.
- **Cancelación automática por rechazo:** Propagación de pagos rechazados o cancelados para marcar el pedido como `CANCELADO` de forma automática (RNF09).
- **Cálculo exacto del total:** Constante `COSTO_DELIVERY = 6.00` integrada en el cálculo de la entidad `Orden`, asegurando que el total cobrado en la pasarela coincida exactamente con la orden en PostgreSQL.

#### docker-compose.local.yml & Infraestructura
- **Túnel HTTPS para Webhooks:** Configuración del contenedor `polleria-tunnel` (Cloudflare Tunnel) para exponer el microservicio de pagos a internet de forma segura en local, permitiendo recibir las notificaciones IPN de Mercado Pago en tiempo real.
- Variables de entorno añadidas para sandbox: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` y `MERCADOPAGO_WEBHOOK_SECRET`.

---

### Frontend (Angular)

#### Checkout y Pasarela
- **Eliminación de `tempOrderId`:** Ahora se crea la orden real en `orders-service` con estado `PENDIENTE_PAGO` antes de solicitar la preferencia a Mercado Pago.
- **Persistencia de sesión:** Almacenamiento seguro de `{ id, code, total }` en `localStorage('sanpollo_last_order')` para resolver el estado tras la redirección externa.
- **Redirección a Checkout Pro:** Apertura automática de la pasarela mediante `sandboxInitPoint` (entorno de pruebas) o `initPoint` (producción).
- **Saneamiento de seguridad:** Se eliminó el Access Token expuesto en el bundle cliente y el proxy `/mp-api`, delegando la creación de preferencias exclusivamente al backend.

#### Páginas de Retorno (`checkout-status.component.ts`)
- **Gestor unificado de estados:** Componente standalone para resolver las tres rutas de retorno: `/checkout/success`, `/checkout/failure` y `/checkout/pending`.
- **Confirmación inmediata ("¡PAGO APROBADO!"):** Detección de parámetros de URL o lectura de `sanpollo_last_order`. Si la orden ya avanzó a `RECIBIDO`, muestra pantalla de éxito al instante con redirección a seguimiento (`/tracking`).
- **Reintento asistido:** En caso de pago rechazado, muestra mensaje de error amigable y botón para reintentar el pago.

#### Servicios y Modelos
- `PaymentService`: Métodos agregados `crearPreferenciaMercadoPago()`, `confirmarRetornoMercadoPago()` y `obtener(pagoId)`.
- `PaymentsApiService`: Adaptador HTTP para los endpoints de Mercado Pago en `payments-service`.
- `environment.ts` & `environment.development.ts`: Configuración centralizada de `mercadoPagoPublicKey`.

---

## 🧪 Pruebas realizadas

- `npm run typecheck` en frontend ✅ 0 errores de tipos en TypeScript
- `mvn clean package -DskipTests` en microservicios backend ✅ `BUILD SUCCESS` sin errores Java
- Flujo E2E automático en Sandbox de Mercado Pago ✅ Pedido #13 (S/. 21.00) cobrado con tarjeta de prueba, webhook IPN recibido y orden avanzada a `RECIBIDO` en < 1 segundo sin autorización manual
- Pruebas de no regresión ✅ Métodos contraentrega (efectivo) y mocks de desarrollo operativos sin afectación

---

## 🎯 Matriz de Trazabilidad de Requerimientos (Oficial UTP)

| Código | Requerimiento Oficial | Implementación con Mercado Pago | Estado |
| :--- | :--- | :--- | :---: |
| **RF19** | Pasarela de pagos en línea | Integración oficial con Checkout Pro (tarjetas débito/crédito y billeteras) vía Orders API (`POST /v1/orders`). | ✅ **Cumplido** |
| **RF20** | Registro de transacciones con estado | Registro persistente en PostgreSQL con ciclo completo: `PENDIENTE` $\to$ `APROBADO`, `RECHAZADO`, `CANCELADO`, `REEMBOLSADO`. | ✅ **Cumplido** |
| **RF21** | Actualización automática de la orden | Notificación reactiva inter-servicio (`X-Internal-Key`) que transiciona la orden a `RECIBIDO` (lista para cocina) en tiempo real. | ✅ **Cumplido** |
| **RNF03** | Comunicación cifrada y validación de firma | Validación criptográfica HMAC-SHA256 de las cabeceras `x-signature` y `x-request-id` con `MERCADOPAGO_WEBHOOK_SECRET`. | ✅ **Cumplido** |
| **RNF09** | Cancelación automática por rechazo | Si la pasarela rechaza la tarjeta o el usuario cancela, el webhook actualiza el pago a `RECHAZADO` y cancela la orden automáticamente. | ✅ **Cumplido** |
| **RF29** | Reembolsos gestionados por administrador | Endpoint `POST /pagos/{id}/reembolso` conectado a `PaymentClient.refund()`, permitiendo reversiones totales o parciales sin salir del sistema. | ✅ **Cumplido** |
