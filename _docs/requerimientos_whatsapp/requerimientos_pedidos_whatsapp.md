# 📲 Requerimientos nuevos y modificados — Pedidos por WhatsApp

**Proyecto:** Sistema de Pedidos y Delivery para Pollería — San Pollo de Ica
**Curso:** Desarrollo Web Integrado (Ciclo 7 — UTP)
**Feature:** `pedidos-whatsapp-anonimos`
**Rama:** `feat/pedidos-whatsapp-anonimos`
**Base oficial:** [REQUERIMIENTOS_DEL_SISTEMA.docx](../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx) (RF01–RF34, RNF01–RNF14)
**Documento ODD del feature:** [odd/tasks/pedidos-whatsapp-anonimos.md](../../odd/tasks/pedidos-whatsapp-anonimos.md)

---

## 1. Contexto y alcance

El pedido del profesor —«hacer pedidos por delivery desde el mismo WhatsApp»— **no está en el SRS
oficial**. En el documento oficial:

- **RF13** dice que el delivery o el recojo los registra el cliente (por la web) y el salón el mozo.
- **RF30–RF32** solo cubren **notificaciones** por WhatsApp (pago confirmado, cambios de estado y
  auditoría de envíos), no la toma de pedidos.

Todo lo implementado para tomar pedidos por WhatsApp (bot conversacional, canal de origen del pedido,
cancelación del invitado, pago por Yape con verificación del admin) es por tanto **alcance nuevo**, y sin
trazabilidad no se puede evaluar. Este documento:

1. Propone los **RF nuevos**, numerados desde **RF35** (el último oficial es RF34).
2. Propone las **modificaciones a RF13 y RF17**, explicando qué cambia y por qué.
3. Da **la traza de cada requerimiento**: commit que lo implementó, archivo donde vive y test que lo prueba.
4. Deja explícito lo que quedó **fuera de alcance o pendiente**.

> **Regla de honestidad de esta traza:** solo se cita como implementado lo que está **commiteado** en la
> rama. Donde un requerimiento no tiene test, se dice; no se inventa cobertura (ver §6).

**Convención de numeración:** no se repite ningún código existente. El SRS oficial termina en RF34; esta
propuesta usa RF35–RF38. Las filas oficiales del SRS no se reescriben: RF13 y RF17 se marcan en la
[matriz](../MATRIZ_TRAZABILIDAD_REQUERIMIENTOS.md) y su modificación se detalla aquí.

**Referencias usadas como fuente de verdad:** el documento ODD del feature (specs S1–S14 y decisiones
L5–L16), [`_docs/fases/fase_3_notificaciones_whatsapp/README.md`](../fases/fase_3_notificaciones_whatsapp/README.md),
[`_docs/fases/fase_1_core_pedidos/03_pedidos_estados.md`](../fases/fase_1_core_pedidos/03_pedidos_estados.md) y
[`04_pagos.md`](../fases/fase_1_core_pedidos/04_pagos.md), y el historial de `git log` de la rama.

---

## 2. Requerimientos funcionales nuevos

### RF35 — Pedido de delivery por WhatsApp sin cuenta

| Campo | Valor |
| :--- | :--- |
| **Código** | RF35 |
| **Módulo propuesto** | Notificaciones / Pedidos y Estados |
| **Microservicio** | `notification-service` (:3001) → `orders-service` (:8082) |
| **Estado** | ✅ Implementado (ramas de T3a, T3b y T3c) |

**Descripción (estilo SRS):** El sistema permitirá registrar pedidos de **delivery** desde el WhatsApp del
negocio **sin que el cliente inicie sesión**, identificándolo únicamente por el celular que escribe. El bot
confirmará primero que el pedido es de **Ica**, mostrará la carta real y armará un carrito hasta que el
cliente confirme; con la dirección de entrega, creará el pedido con la misma ruta pública del checkout web.

**Motivo (spec S1/S12):** «No vamos a iniciar sesión desde whatsapp, solo se va a hacer pedidos anonimos»;
el pedido es a nivel de Ica y la persona debe confirmarlo antes de continuar.

**Artefactos en código:**

| Artefacto | Ruta |
| :--- | :--- |
| Motor conversacional (menú, Ica, catálogo, carrito, alta) | `polleria/notification-service/src/chatbot/chatbot.js` |
| Cartera de textos / formato de carta | `polleria/notification-service/src/chatbot/menu.js` |
| Catálogo real con cache corto y fallo explícito | `polleria/notification-service/src/pedidos/catalogo.js` |
| Alta del `DELIVERY` anónimo y total devuelto | `polleria/notification-service/src/pedidos/ordenes.js` |
| Estado de conversación persistido (misma base del historial + fallback en memoria) | `polleria/notification-service/src/chatbot/conversation.js` |
| Dedup por `message.id` | `polleria/notification-service/src/chatbot/dedup.js` |
| Serialización por conversación | `polleria/notification-service/src/chatbot/serializador.js` |
| Handler que encola la respuesta por la cola única | `polleria/notification-service/src/whatsapp/handler.js` |

**Criterios de aceptación (verificables):**

1. Antes de tomar el pedido, el bot pregunta si es de **Ica**. Si la persona dice que **no**, no avanza y
   ofrece el número del asesor.
2. La carta sale de `GET /productos` de `orders-service`; si el servicio falla o responde error, el bot
   **no inventa catálogo** y avisa que no puede tomar el pedido.
3. El carrito se arma por el **número** de la carta: agrega, suma cantidad al repetir producto, permite
   `quitar <número>` y persiste entre mensajes (y tras reinicio, con `DATABASE_URL`).
4. `confirmar` sin dirección **no crea** la orden: pide la dirección y luego la referencia.
5. Con dirección y carrito, `confirmar` crea **una** orden `DELIVERY` con `canalOrigen = WHATSAPP` y el
   celular del remitente normalizado como `telefonoCliente`.
6. El resumen previo muestra **solo el subtotal**; el envío se suma al confirmar y el total del mensaje
   final es el que devuelve `orders-service` (el bot no duplica el cálculo del envío).
7. Confirmar dos veces, o la reentrega del mismo `message.id`, crea **una sola** orden.
8. Dos `confirmar` **simultáneos con `message.id` distintos** del mismo celular crean **una sola** orden.
9. Un celular lento **no bloquea** a otro celular.
10. Si `orders-service` falla al crear la orden, el bot lo dice, **no inventa número de pedido** y conserva
    el carrito para reintentar.
11. El pedido queda consultable en el seguimiento por celular (ver **RF17**).

**Traza:**

| Commit | Qué agregó | Archivo principal | Test | Casos |
| :--- | :--- | :--- | :--- | :--- |
| `006fc97` | Catálogo real, confirmación de Ica, estado persistido, dedup y oferta del asesor | `src/chatbot/chatbot.js`, `src/pedidos/catalogo.js`, `src/chatbot/conversation.js`, `src/chatbot/dedup.js` | `polleria/notification-service/test/pedidos-bot.test.js` | `el primer mensaje que pide un pedido pregunta si es de Ica y no, no avanza y ofrece el asesor` · `responder que sí avanza al catálogo real` · `el catálogo sale de GET /productos y el cache evita la segunda llamada` · `si orders-service falla, el bot avisa que no puede tomar el pedido y ofrece el asesor` · `si orders-service responde con error, tampoco se inventa el catálogo` · `el mismo message.id procesado dos veces ejecuta un solo paso` · `sin DATABASE_URL el estado usa el fallback en memoria y el flujo funciona` · `el estado de conversación sobrevive a reconstruir el bot (misma base)` |
| `42197b5` | Carrito, resumen, alta del `DELIVERY` anónimo y mensaje con número y total | `src/chatbot/chatbot.js`, `src/pedidos/ordenes.js`, `src/chatbot/conversation.js`, `src/chatbot/menu.js` | `polleria/notification-service/test/pedidos-carrito.test.js` | `(a) armar carrito: agregar por número, sumar cantidad, quitar y seguir en el mensaje siguiente` · `(b) el resumen muestra los ítems y no calcula el envío por su cuenta` · `(c) confirmar con dirección crea una orden DELIVERY por WhatsApp con el total devuelto` · `(d) confirmar dos veces y la reentrega del mismo mensaje crean una sola orden` · `(e) si orders-service falla no hay número de pedido y el carrito queda para reintentar` · `(f) confirmar sin dirección no crea la orden y pide la dirección` · `(g) confirmar con el carrito vacío no crea la orden` |
| `df9e85e` | Serializador por conversación (corta la doble creación con `message.id` distintos) | `src/chatbot/serializador.js`, `src/whatsapp/handler.js` | `polleria/notification-service/test/pedidos-serializacion.test.js` | `(a) dos confirmar simultáneos con message.id distintos del mismo celular abren una sola orden` · `(b) un celular lento no bloquea a otro celular: cada uno avanza por su cuenta` · `(c) el segundo mensaje de la misma conversación ve el efecto del primero` |
| `57ab828` | `canalOrigen` aceptado en el alta (el bot manda `WHATSAPP`) | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/service/OrdenService.java` | `polleria/orders-service/src/test/java/com/sistema/polleria/orders/controller/CanalOrigenTest.java` | `unPedidoDeWhatsappGuardaSuCanal` |

---

### RF36 — Pago por Yape desde WhatsApp con verificación del comprobante por el administrador

| Campo | Valor |
| :--- | :--- |
| **Código** | RF36 |
| **Módulo propuesto** | Pagos y Finanzas |
| **Microservicio** | `notification-service` (:3001) → MinIO → `payments-service` (:8083) |
| **Estado** | ✅ Implementado el backend (`T6a`, `T6b` y `T6c`); ⏳ el **panel del admin** y el **aviso del rechazo al cliente** (`T6d`) están pendientes |

**Descripción (estilo SRS):** El sistema permitirá al cliente que pidió por WhatsApp enviar la **imagen del
comprobante de Yape** por el mismo chat; el sistema la guardará en MinIO y registrará la evidencia en el
servicio de pagos dejándola **pendiente de verificación**. El **administrador** verificará el comprobante y
aprobará o rechazará el pago; solo el rol `ADMIN` puede hacerlo.

**Motivo (spec S6/S7):** «Para pagos a traves de whatsapp, apliquemos yape, si es por yape el admin tiene
que verificar el comprobante y darle a que el pedido es valid, solo admin»; «Utilicemos MinIO para simular
el bucket que luego desplegaremos».

**Artefactos en código (implementado):**

| Artefacto | Ruta |
| :--- | :--- |
| Subida del comprobante a MinIO (bucket, clave, cliente y reloj inyectables) | `polleria/notification-service/src/pedidos/almacenamiento.js` |
| Registro del comprobante en `payments-service` con `X-Internal-Key` | `polleria/notification-service/src/pedidos/pagos.js` |
| Flujo del comprobante en el bot (imagen, no-imagen, sin pedido) | `polleria/notification-service/src/chatbot/chatbot.js` |
| Endpoint interno de registro y estado `PENDIENTE_VERIFICACION` | `polleria/payments-service/src/main/java/com/sistema/polleria/payments/controller/PagoController.java`, `service/PagoService.java`, `entity/EstadoPago.java` |
| DTO del comprobante | `polleria/payments-service/src/main/java/com/sistema/polleria/payments/dto/RegistrarComprobanteRequest.java` |
| Verificación de `ADMIN`: aprobar/rechazar (`T6c`) | `polleria/payments-service/src/main/java/com/sistema/polleria/payments/controller/PagoController.java`, `service/PagoService.java`, `dto/VerificarPagoRequest.java` |
| URL firmada del comprobante y cliente MinIO del lado servidor (`T6c`) | `polleria/payments-service/src/main/java/com/sistema/polleria/payments/service/FirmadorComprobantes.java`, `config/MinioConfig.java` |

**Criterios de aceptación (verificables):**

1. Al llegar una **imagen** con un pedido confirmado, el bot la sube a MinIO con la clave
   `comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}` (crea el bucket si falta).
2. Luego registra la evidencia con `POST /pagos/comprobante` y `X-Internal-Key`, dejando el pago en
   `PENDIENTE_VERIFICACION` (no en `APROBADO`).
3. Si el mensaje es **texto** o un adjunto que **no es imagen**, no sube ni registra y pide una imagen.
4. **Sin pedido confirmado**, el bot no acepta nada y dice qué falta.
5. Si falla la subida a MinIO o el registro en `payments-service`, el bot lo dice y pide reenviar; **nunca
   inventa un éxito**.
6. Dos registros de la misma orden **no duplican** el pago (idempotencia por orden).
7. El `ADMIN` ve la **URL firmada** del comprobante y **aprueba o rechaza**
   (`POST /pagos/{id}/verificar`); con un rol que no es `ADMIN` (o sin token) responde `403`/`401` y el
   pago no cambia; rechazar sin motivo responde `400`; verificar un pago que no está
   `PENDIENTE_VERIFICACION` responde `409`.
8. Al **aprobar**, el pago queda `APROBADO` con `verificadoPor`/`verificadoEn` y la orden avanza con el
   mismo mecanismo del pago de Mercado Pago; al **rechazar**, queda `RECHAZADO` con el motivo y la orden
   **no** avanza. Un comprobante nuevo puede reemplazar a uno `PENDIENTE_VERIFICACION` o `RECHAZADO`, y
   **nunca** a uno `APROBADO`. El rechazo **no cancela** el pedido: lo deja impago esperando un comprobante
   válido. El aviso al cliente por WhatsApp es `T6d` (pendiente).

**Traza:**

| Commit | Qué agregó | Archivo principal | Test | Casos |
| :--- | :--- | :--- | :--- | :--- |
| `472ec6f` | Evidencia del pago en `payments-service`: estado `PENDIENTE_VERIFICACION`, clave del comprobante y endpoint interno (`T6a`) | `PagoController.java`, `PagoService.java`, `EstadoPago.java`, `RegistrarComprobanteRequest.java` | `polleria/payments-service/src/test/java/com/sistema/polleria/payments/controller/RegistrarComprobantePagoTest.java` | `registrarElComprobanteCreaElPagoYapePendienteDeVerificacion` · `sinClaveInternaResponde401` · `conClaveInternaInvalidaResponde401` · `sinOrdenIdResponde400YNoCreaNada` · `conOrdenIdInvalidoResponde400YNoCreaNada` · `dosRegistrosDeLaMismaOrdenNoDuplicanElPago` (todos con `@DisplayName` «T6a: …») |
| `62aa686` | Subida a MinIO, registro en payments-service y flujo del comprobante en el bot (`T6b`) | `src/pedidos/almacenamiento.js`, `src/pedidos/pagos.js`, `src/chatbot/chatbot.js` | `polleria/notification-service/test/pedidos-comprobante.test.js` | `el almacenamiento crea el bucket si falta y sube con la clave comprobantes/yape/{ordenId}/{timestamp}-{messageId}.{ext}` · `el cliente de pagos manda POST /pagos/comprobante con X-Internal-Key y el cuerpo del comprobante` · `(a) una imagen con pedido confirmado se sube con la clave esperada, se registra y se confirma` · `(b) un mensaje de texto con el pedido confirmado no sube ni registra y pide una imagen` · `(c) si falla la subida a MinIO no se registra y el bot pide reenviar sin inventar éxito` · `(d) si falla el registro en payments-service el bot lo avisa y no simula el éxito` · `(e) sin pedido confirmado no se acepta el comprobante y se dice qué falta` |
| `15b346d` | Verificación exclusiva de `ADMIN`: aprobar/rechazar, avance de la orden al aprobar, reemplazo de evidencia y URL firmada del comprobante (`T6c`) | `config/MinioConfig.java`, `dto/VerificarPagoRequest.java`, `service/FirmadorComprobantes.java`, `service/PagoService.java`, `controller/PagoController.java` | `polleria/payments-service/src/test/java/com/sistema/polleria/payments/controller/VerificarComprobanteYapeTest.java` | `adminApruebaYLaOrdenAvanza` · `adminRechazaConMotivoYLaOrdenNoAvanza` · `sinTokenDeAdminNoSePuedeVerificar` · `rechazarSinMotivoResponde400YNoCambiaElPago` · `unComprobanteNuevoReemplazaAUnoRechazado` · `unComprobanteNuevoNoReemplazaAUnoAprobado` · `laUrlFirmadaSeGeneraSoloParaAdmin` · PRESERVE: `unPagoSinComprobanteSigueVisibleParaElMozo` · PRESERVE: `cancelarSigueFuncionandoYNoExponeLaClave` |

> **Cobertura:** `T6c` se commiteó en `15b346d` una vez redactada esta propuesta; su traza ya se refleja
> arriba. Queda **sin test** el **panel del admin** y el **aviso del rechazo al cliente** (`T6d`), que no
> están implementados (ver §5).

---

### RF37 — Registro del canal de origen del pedido

| Campo | Valor |
| :--- | :--- |
| **Código** | RF37 |
| **Módulo propuesto** | Pedidos y Estados |
| **Microservicio** | `orders-service` (:8082) + `frontEnd` |
| **Estado** | ✅ Implementado (`T2`) |

**Descripción (estilo SRS):** El sistema registrará el **canal por el que entró** cada pedido
(`WEB`, `WHATSAPP` o `SALON`), lo expondrá en la respuesta del pedido y lo aceptará, opcionalmente, en el
alta. Cuando el alta no lo envíe, el canal se derivará del tipo de pedido.

**Motivo (spec S1):** permite medir y auditar los pedidos de WhatsApp sin romper el checkout web ni la
comanda de salón existentes.

**Artefactos en código:**

| Artefacto | Ruta |
| :--- | :--- |
| Enum del canal | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/entity/CanalOrigen.java` |
| Campo nullable en la orden | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/entity/Orden.java` |
| Derivación del canal en el alta | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/service/OrdenService.java` |
| Aceptado en el request / expuesto en la respuesta | `dto/CrearOrdenRequest.java`, `dto/OrdenResponse.java` |
| Mapeo en el frontend | `frontEnd/src/app/core/adapters/order.adapter.ts`, `frontEnd/src/app/core/models/order.model.ts` |

**Criterios de aceptación (verificables):**

1. Un alta con `canalOrigen = WHATSAPP` guarda `WHATSAPP` y lo devuelve en la respuesta.
2. Un alta sin `canalOrigen` de un pedido que **no es de salón** queda como `WEB` (compatible con el
   checkout web actual, que no manda el campo).
3. Una comanda `SALON` sin `canalOrigen` queda como `SALON`.
4. Un canal desconocido (p. ej. `TELEGRAM`) se rechaza con `400` y **no crea pedido**.
5. La columna es **nullable**: los pedidos creados antes del campo no se rompen.

**Traza:**

| Commit | Qué agregó | Archivo principal | Test | Casos |
| :--- | :--- | :--- | :--- | :--- |
| `57ab828` | Enum `CanalOrigen`, campo, derivación por tipo, exposición y mapeo del frontend | `Orden.java`, `OrdenService.java`, `CanalOrigen.java` | `polleria/orders-service/src/test/java/com/sistema/polleria/orders/controller/CanalOrigenTest.java` | `unPedidoDeWhatsappGuardaSuCanal` · `unPedidoDelCheckoutWebSinCanalExplicitoQuedaComoWeb` · `unaComandaDeSalonSinCanalExplicitoQuedaComoSala` · `unCanalDesconocidoSeRechazaYNoCreaPedido` |

> **Sin cobertura de test en el frontend:** el mapeo `canalOrigen` en `order.adapter.ts` /
> `order.model.ts` no tiene un caso propio en `frontEnd/src/app/core/adapters/order.adapter.spec.ts`. La
> cobertura del requerimiento es del lado backend.

---

### RF38 — Cancelación del pedido propio por el cliente sin cuenta

| Campo | Valor |
| :--- | :--- |
| **Código** | RF38 |
| **Módulo propuesto** | Pedidos y Estados |
| **Microservicio** | `orders-service` (:8082) + `frontEnd` |
| **Estado** | ✅ Implementado (`T1`) |

**Descripción (estilo SRS):** El sistema permitirá al cliente que pidió **sin iniciar sesión** cancelar su
**propio** pedido desde el seguimiento, usando el celular que ya verificó con el código de WhatsApp,
mientras el pedido no esté en un estado terminal.

**Motivo (spec S5, «arregla el problema 2»):** un pedido de invitado no tiene dueño autenticado, así que
`PATCH /ordenes/{id}/estado` le respondía `404`; la UI de seguimiento además no ofrecía cancelar.

**Artefactos en código:**

| Artefacto | Ruta |
| :--- | :--- |
| Ruta solo de cancelación (`POST /ordenes/seguimiento/{id}/cancelar`) | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/controller/SeguimientoController.java` |
| Cancelación delegada en `OrdenService.actualizarEstado` | `polleria/orders-service/src/main/java/com/sistema/polleria/orders/service/SeguimientoService.java` |
| Botón de cancelar en el seguimiento | `frontEnd/src/app/features/client/order-tracking/order-tracking.component.ts` |
| Llamada del frontend | `frontEnd/src/app/core/services/orders.service.ts` |

**Criterios de aceptación (verificables):**

1. El invitado con su celular verificado cancela su **propio** pedido no terminal → éxito.
2. Un pedido de **otro celular** responde `404` (misma convención anti-enumeración del seguimiento).
3. Sin acceso verificado (token ausente/inválido/vencido) responde `400`.
4. Un pedido ya `ENTREGADO` o `CANCELADO` se rechaza por la máquina de estados (`400`).
5. La ruta **solo cancela**: no acepta estados arbitrarios, así que no reemplaza el flujo de cocina y
   reparto.
6. Los efectos secundarios de la cancelación (log, liberación de mesa, notificación) son los mismos que
   los de una cancelación hecha por el personal (delega en `OrdenService.actualizarEstado`).

**Traza:**

| Commit | Qué agregó | Archivo principal | Test | Casos |
| :--- | :--- | :--- | :--- | :--- |
| `cee9204` | Endpoint `POST /ordenes/seguimiento/{id}/cancelar`, `SeguimientoService.cancelarPedido`, botón en la UI y docs de fase 1 y 3 | `SeguimientoController.java`, `SeguimientoService.java` | `polleria/orders-service/src/test/java/com/sistema/polleria/orders/controller/CancelacionInvitadoTest.java` | `unInvitadoConSuCelularVerificadoCancelaSuPropioPedido` · `unInvitadoNoPuedeCancelarElPedidoDeOtroCelular` · `sinAccesoVerificadoNoSePuedeCancelar` · `noSePuedeCancelarUnPedidoYaEntregado` |

> **Preservación:** el commit deja verdes los casos previos de
> `polleria/orders-service/src/test/java/com/sistema/polleria/orders/service/SeguimientoServiceTest.java`
> (`codigoCorrectoDaAccesoSoloALosPedidosDeEseCelular`, `accesoAlteradoEsRechazado`).
>
> **Sin cobertura de test en el frontend:** el botón de cancelar de
> `order-tracking.component.ts` no tiene spec (`order-tracking/` no tiene `*.spec.ts`). La cobertura del
> requerimiento es del lado backend.

---

## 3. Requerimientos funcionales modificados

### RF13 (modificado) — Canales de registro del pedido

**Texto oficial:** «El sistema permitirá registrar pedidos para consumo en salón (por el mozo), *delivery*
o recojo (por el cliente).»

**Qué cambia:** el catálogo de canales de registro deja de ser solo «web/cliente» y «mozo/salón». Se agrega
un **tercer canal de alta**: el **bot de WhatsApp**, que registra `DELIVERY` **anónimos** (sin login) usando
la ruta pública `POST /ordenes`, con `canalOrigen = WHATSAPP` y el celular del remitente como identidad.
Además, todo pedido ahora **registra su canal de origen** (`WEB`, `WHATSAPP` o `SALON`) y lo expone en la
respuesta.

**Por qué:** el profesor pidió tomar pedidos por delivery desde el mismo WhatsApp; hacerlo sin cuenta
obliga a (a) abrir un canal de alta nuevo y (b) poder distinguir y auditar por dónde entró cada pedido.

**Impacto:** `orders-service` (`Orden`, `OrdenService`, `CrearOrdenRequest`, `OrdenResponse`),
`notification-service` (bot) y `frontEnd` (modelo/adaptador).

**Traza:** `57ab828` (canal de origen, `CanalOrigenTest.java`) y `42197b5` (alta del pedido por el bot,
`pedidos-carrito.test.js`). Criterios completos en **RF37** y **RF35**.

---

### RF17 (modificado) — Consulta del estado por el cliente sin cuenta

**Texto oficial:** «El sistema permitirá a los clientes consultar el estado actual de su pedido.»

**Qué cambia:** la consulta del estado deja de asumir una cuenta con sesión. El cliente **sin cuenta**
consulta (y ahora también **cancela**, ver RF38) sus pedidos autenticándose con el **celular verificado por
código de WhatsApp** (`POST /ordenes/seguimiento/codigo`, `POST /ordenes/seguimiento/verificar`,
`GET /ordenes/seguimiento`), que devuelve un acceso temporal. La vista de seguimiento muestra los pedidos
de ese celular y, si el pedido es cancelable, ofrece el botón de cancelar.

**Por qué:** quien pide por WhatsApp lo hace sin iniciar sesión (S1), así que el seguimiento tiene que
funcionar con esa misma identidad temporal; y el invitado necesitaba poder cancelar su propio pedido
(problema 2 / S5).

**Impacto:** `orders-service` (flujo de seguimiento y cancelación) y `frontEnd` (vista de seguimiento).

**Traza:** el flujo de consulta por celular viene de `aec5021` (Fase 3); la ampliación de esta feature
(cancelación del invitado desde el seguimiento) se implementó en `cee9204`, cubierta por
`CancelacionInvitadoTest.java` (casos en **RF38**).

---

## 4. Trazabilidad de trabajo implementado que no propone RF nuevo

Estas piezas se implementaron en la misma feature y **no** proponen un RF nuevo porque son soporte de
RNF10 o de los specs S2/S4/S8/S11. Se listan aquí para que no queden sin traza.

### 4.1 Anti-baneo del canal de WhatsApp (spec S2/S8; refuerza RNF10)

Reemplaza el envío directo por **una sola cola saliente** (el chatbot ya no usa `msg.reply`), con
humanización («visto» + «escribiendo»), jitter y, sobre la misma cola, un gobernador en memoria con
presupuesto por hora/día, ventana horaria y circuit breaker. La configuración vive en memoria (S8).

| Commit | Qué agregó | Archivos | Tests |
| :--- | :--- | :--- | :--- |
| `0a1e133` | Cola única, humanización y jitter, ajustes en memoria | `src/notifications/queue.js`, `src/notifications/service.js`, `src/outbound/ajustes.js`, `src/outbound/humanizacion.js` | `polleria/notification-service/test/antibaneo.test.js`: `un mensaje del bot y una notificación comparten la misma cola: nunca a la vez y con espaciado` · `el "escribiendo" sale antes del mensaje y dura lo proporcional al texto, entre el mínimo y el máximo` · `el chatbot ya no envía por su cuenta: devuelve el texto y el handler lo encola` |
| `ab8584e` | Presupuesto por hora/día, ventana horaria y circuit breaker | `src/outbound/gobernador.js`, `limites.js`, `breaker.js` | `polleria/notification-service/test/anti-baneo-2.test.js`: `presupuesto por hora agotado: la cola se pausa, /status lo dice y reanuda a la hora nueva` · `fuera de la ventana horaria el trabajo sigue pendiente y /status reporta el motivo` · `una señal de rate-overlimit abre el breaker, el backoff crece y la cola reanuda al vencer` · `el breaker no pierde trabajos encolados` |

### 4.2 Configuración del servicio de WhatsApp desde el panel (spec S4/S8/S11)

Endpoints `GET`/`PATCH /api/notificaciones/ajustes` solo `ADMIN` sobre el store en memoria, con los
números de asesor y de respaldo, más la pantalla «Anti-baneo y contactos» del panel.

| Commit | Qué agregó | Archivos | Tests |
| :--- | :--- | :--- | :--- |
| `04c6214` | API `GET`/`PATCH /ajustes` (solo ADMIN) | `src/http/app.js`, `src/outbound/ajustes.js` | `polleria/notification-service/test/ajustes-http.test.js`: `GET /ajustes es solo ADMIN y devuelve los ajustes vigentes con el estado del gobernador` · `PATCH /ajustes es solo ADMIN, aplica el cambio en caliente y se ve en GET y en /status` · `PATCH /ajustes con valores inválidos responde 400 y deja el store exactamente como estaba` · `los números de asesor y respaldo se guardan normalizados y el respaldo vacío es válido` |
| `844e1f8` | Servicio del frontend | `frontEnd/src/app/core/services/whatsapp-notifications.service.ts` | `frontEnd/src/app/core/services/whatsapp-notifications.service.spec.ts`: `obtenerAjustes() hace GET a /ajustes y devuelve { ajustes, gobernador }` · `actualizarAjustes() hace PATCH mandando solo los campos cambiados` · `un 400 del backend se propaga con su mensaje y no reporta éxito` |
| `7898897` | Pantalla del panel | `frontEnd/src/app/features/admin/dashboard/admin-dashboard.component.ts` | Sin spec propio del componente (limitación declarada en L10) |

---

## 5. Fuera de alcance / pendiente

| # | Pendiente | Spec / Task | Estado |
| :--- | :--- | :--- | :--- |
| 1 | **Panel del admin para ver y aprobar/rechazar** el comprobante (el backend `T6c` ya está en `15b346d`) | S6 · `T6d` | Pendiente |
| 2 | **Aviso del rechazo al cliente por WhatsApp** | S6 · `T6d` (L16) | Pendiente |
| 3 | **Repartidor: lista de disponibles + reclamo atómico** que evite el doble reparto | S10 · `T11` | Pendiente (RF18 ya existe para la asignación) |
| 4 | **Degradación por caída/baneo del número principal** (número de respaldo operativo y estado visible) | S11 · `T9` | Pendiente; los números ya se configuran y el bot los ofrece (T5/T5b) |
| 5 | **Reserva de stock al crear el pedido** | S9 · `T10` | **Quitado del alcance** por pedido del dueño: no se toca `inventory-service` |
| 6 | **Persistencia de la configuración anti-baneo** | S8 | Fuera de alcance a propósito: vive en memoria y se pierde al reiniciar |

---

## 6. Comprobaciones de esta propuesta

- **Numeración:** los RF nuevos son **RF35, RF36, RF37 y RF38**; el SRS oficial termina en **RF34**
  (`RF01–RF34`) según [`requerimientos_extraidos.txt`](../Bases/requerimientos_extraidos.txt). No se repite
  ningún código.
- **Rutas citadas:** todas existen en el repositorio (verificadas con `ls`/`grep`).
- **Tests citados:** todos los casos nombrados existen en su archivo de test (verificados con `grep`).
- **Sin test (se declara, no se inventa):**
  - mapeo de `canalOrigen` en el frontend (RF37);
  - botón de cancelar y llamada del frontend al endpoint de cancelación (RF38);
  - la pantalla del panel de ajustes no tiene spec de componente (corresponde a §4.2);
  - el panel de verificación del admin y el aviso del rechazo (`T6d`); el backend de RF36 (`T6c`) sí tiene test en `VerificarComprobanteYapeTest.java`.
- **No modificados:** el `.docx` oficial y `requerimientos_extraidos.txt` (derivado del docx) no se tocaron.
