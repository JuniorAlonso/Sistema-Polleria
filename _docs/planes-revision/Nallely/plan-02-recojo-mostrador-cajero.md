# Plan de Revisión 2: Recojo en Tienda, Venta en Mostrador y Prueba de Humo de Canales

**Responsable:** Compañero 2
**Servicios:** `orders-service` (8082), `payments-service` (8083), `finance-service` (8087, como consumidor), `auth-service` (sanciones), `frontEnd` (`/cajero`)
**Tablas:** `ordenes`, `orden_items`, `productos`, `pagos`, `sanciones_cliente`, `comprobantes_pago`, `movimientos_caja`
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Certificar los pedidos `RECOJO` en sus dos variantes:

1. **Recojo digital:** nace en la web o en WhatsApp, con ticket `POL-{id}`.
2. **Venta en mostrador:** cliente presencial atendido por el Cajero. **Hoy no existe y debe construirse.**

Además, este Plan certifica con una prueba de humo el delivery, el bot y el checkout, que no tenían responsable.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D2.1 | La venta en mostrador es una orden `{tipo: RECOJO, canalOrigen: SALON, estadoInicial: PENDIENTE_PAGO, nombreCliente: "Mostrador"}`. | `POST /ordenes` ya lo admite; no requiere tablas ni estados nuevos. |
| D2.2 | La orden de mostrador se guarda con `clienteId=0`. | Hoy quedaría asociada al cajero, y una sanción le llegaría a él. |
| D2.3 | Se reutiliza `iniciarPago` + `confirmarPago`, sin `completarOrdenSalon`. El pago aprobado lleva la orden a `RECIBIDO`. | Si se abandona, el scheduler la cancela y repone stock. |
| D2.4 | Tarjeta y Yape en ventanilla son **confirmación manual del cajero**: verifica el POS físico o el Yape recibido. No hay pasarela. | Comportamiento actual, ahora explícito. |
| D2.5 | El cobro contra-entrega de recojo es **solo en efectivo**. | `/pagos/cobro-efectivo` es la única vía y el tab solo pide efectivo. |
| D2.6 | El comprobante de `RECOJO` se emite al **entregar**, y el de mostrador al **cobrar**. Se elimina la emisión al confirmar la llamada para `RECOJO`. | Evita una boleta rotulada "COBRAR EN EFECTIVO" y da comprobante al prepago. |
| D2.7 | Solo se sanciona el abandono si `requiereCobroEfectivo=true`. | No se penaliza a quien ya pagó, y excluye el mostrador. |
| D2.8 | El fantasma prepagado no se reembolsa automáticamente: `ADMIN` decide. | Reembolso manual ya existente. |
| D2.9 | Entre intentos de llamada deben pasar al menos 5 minutos. Se calcula con `actualizadoEn`. | Sin columna nueva, y compatible con la expiración a 15 minutos. |
| D2.10 | Cocina atiende en orden de llegada (FIFO). No se agrega prioridad. | No existe el campo y no es imprescindible. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿Existe el modal de mostrador? | No. El POS filtra solo `SALON`. | Componente nuevo (sección 5). |
| ¿Hay hash en el ticket? | No. Se compara `POL` + id. | Se corrige el texto; R2.2 prueba esa comparación. |
| ¿Se valida el ticket en backend? | Sí, también en llamadas internas. | Certificar. |
| ¿El cajero puede leer el código en pantalla? | Sí, la tarjeta lo muestra. | Mostrar número y nombre del cliente, no el código. |
| ¿Se exige caja abierta? | No, si está cerrada se cobra sin registrar el ingreso. | `motivoBloqueo` con consulta fresca de caja (solo efectivo, UI). |
| ¿Se duplica el ingreso al reintentar? | Sí. | Plan 3 hace el `INGRESO` idempotente por orden. |
| ¿Qué pasa si el pago sale bien y la entrega falla? | La UI dice "cobrado y entregado" con la orden en `LISTO`. | Releer la orden y avisar; reintentar es seguro. |
| ¿Si la notificación de pago falla en mostrador? | La orden pagada sigue en `PENDIENTE_PAGO` y el scheduler la cancelaría. | `confirmar` reenvía si sigue pendiente. |
| ¿El límite de 2 llamadas lo impone el backend? | Sí, con `intentos_llamada`. Falta el espaciado. | D2.9. |
| ¿Se repone stock al cancelar? | Sí, de forma idempotente. | Agregar test. |
| ¿Se pierde la sanción si auth falla? | Sí, es asíncrona. | Riesgo aceptado, con log. |

---

## 4. Flujos de datos

### 4.1 Venta en mostrador

| # | Paso | Frontend | Backend | BD |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Crear pedido | `cajero-mostrador-modal`; consulta fresca de caja si es efectivo | `POST /ordenes` con D2.1 y D2.2 | `ordenes` (`PENDIENTE_PAGO`), `orden_items`, `productos.stock` |
| 2 | Cobrar | `iniciarPago` + `confirmarPago` | `PagoService`; notifica a orders | `pagos` (`APROBADO`), `ordenes.estado=RECIBIDO` |
| 3 | Comprobante y caja | `registrarVentaEnCaja` (Plan 3) | `POST /finanzas/comprobantes` con `ingresoCaja` si es efectivo | `comprobantes_pago`, `movimientos_caja` |
| 4 | Preparar | KDS con rótulo `MOSTRADOR` | `PATCH /ordenes/{id}/estado` | `ordenes.estado=LISTO`, `listo_at` |
| 5 | Entregar | Tab Recojo con ticket | Valida `POL-{id}` | `ordenes.estado=ENTREGADO` |

### 4.2 Recojo digital contra-entrega

| # | Paso | Frontend | Backend | BD |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Confirmar por llamada | `cajero-llamadas-tab` | Confirma o registra intento | `ordenes.estado=RECIBIDO` o `intentos_llamada+1`; al segundo intento `CANCELADO` y repone stock |
| 2 | Cobrar y entregar | Tab Recojo: ticket y monto; bloqueado sin caja | `POST /pagos/cobro-efectivo`, valida ticket y llama a orders con clave interna | `pagos`, `ordenes.estado=ENTREGADO` |
| 3 | Comprobante y caja | `registrarVentaEnCaja` con `ingresoCaja=true` | `POST /finanzas/comprobantes` | `comprobantes_pago`, `movimientos_caja` |
| 4 | Verificación | Relee la orden; si sigue `LISTO`, avisa "entrega pendiente" | Reintento idempotente | — |

### 4.3 Recojo prepagado

Ticket → `PATCH /ordenes/{id}/estado` con `codigoTicket` → `ENTREGADO` → `registrarVentaEnCaja` con `ingresoCaja=false`.

### 4.4 Pedido fantasma

`OrdenExpiracionScheduler` lo declara cada 30 s pasados 60 minutos desde `listoAt`, o el cajero con `POST /ordenes/{id}/pedido-fantasma`. Resultado: `PEDIDO_FANTASMA`, sin reponer stock, y `sanciones_cliente` solo según D2.7.

---

## 5. Cambios por capa

### Base de datos

Sin cambios de esquema. Se reutilizan `canal_origen`, `requiere_cobro_efectivo`, `intentos_llamada`, `listo_at` y `actualizado_en`.

### Backend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `OrdenService.crear` | Aplica D2.2 cuando el personal crea `RECOJO` con `canalOrigen=SALON`. | Corregir |
| `OrdenService` (llamadas) | Aplica D2.9 con 409. Exige teléfono en `PENDIENTE_CONFIRMACION`. | Corregir |
| `OrdenService.declararPedidoFantasma` | Aplica D2.7. | Corregir |
| `PagoService.confirmar` | Reenvía la notificación si la orden sigue `PENDIENTE_PAGO`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `cajero-mostrador-modal` | Carta rápida, cobro y datos fiscales. | Nuevo |
| `cajero-recojo-tab` | `motivoBloqueo` sin caja, muestra número y nombre, placeholder sin ceros (`POL-42`), etiqueta "PAGADO" solo con pago verificado. | Corregir |
| `cajero-dashboard` (`entregarRecojo`, `procesarCobroEfectivo`) | Emisión al entregar, relectura de la orden, retiro de la emisión en la llamada para `RECOJO`. | Corregir |

---

## 6. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R2.1 | Confirmación por llamada | Confirmar lleva la orden a `RECIBIDO`. El segundo intento antes de 5 minutos responde 409. Dos intentos válidos la cancelan y reponen stock. |
| R2.2 | Entrega prepagada | Con orden `LISTO`, `POL-{id}` correcto da `ENTREGADO` y emite boleta. Un código incorrecto es rechazado también por API. |
| R2.3 | Contra-entrega | Solo efectivo. Sin caja abierta: bloqueado. Monto menor al total: bloqueado. Monto suficiente: vuelto exacto, un pago, un `INGRESO`, un comprobante, también al reintentar. Por API sin clave interna: 409. |
| R2.4 | Mostrador | El cajero crea y cobra (efectivo, tarjeta o Yape manual) y recibe comprobante y ticket `POL-{id}`. KDS muestra `MOSTRADOR` y atiende por orden de llegada. Un pedido abandonado se cancela a los 15 minutos con reposición de stock. |
| R2.5 | Fantasma | Antes de 60 minutos responde 409 con `"Aún no se cumple la espera en tienda del pedido #N: faltan X min para declararlo fantasma"`. Después: `PEDIDO_FANTASMA`, sin reponer stock, sanción solo con `requiereCobroEfectivo=true`. |
| R2.6 | Prueba de humo | Todos los escenarios de la sección 7 pasan o quedan documentados como defecto. |

---

## 7. Prueba de humo de otros canales

No se cambia funcionalidad. Cada defecto se registra con evidencia.

| Canal | Escenario |
| :--- | :--- |
| Delivery | `LISTO` → `EN_CAMINO` → `EN_PUERTA` → `ENTREGADO`, y fantasma en puerta. |
| Web | Checkout, seguimiento por código y rechazo de un plato agotado. |
| Bot de WhatsApp | `node --test` en `polleria/notification-service` y un pedido real. **No reconstruir el servicio sin coordinar** (Plan 00, sección 7). |

---

## 8. Contratos con otros planes

- **Recibe de Plan 3:** `registrarVentaEnCaja`, input `cajaAbierta` y componente de datos fiscales.
- **Entrega a Plan 1:** la regla del rótulo `MOSTRADOR`.
- **Recibe de Plan 4:** el motor de stock y su reposición.

---

## 9. Alcance

**Incluye:** recojo, llamadas, mostrador, fantasma y prueba de humo.

**No incluye:** contenido fiscal e IGV, arqueo (Plan 3); croquis y KDS (Plan 1); motor de stock (Plan 4); comprobante del delivery prepagado, que queda como limitación conocida.

---

## 10. Verificación

```bash
cd polleria
./mvnw test -pl orders-service "-Dtest=OrdenCompuertasNegocioTest,OrdenFlujoBordesTest,OrdenExpiracionSchedulerTest,SancionDispatcherServiceTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/cajero/**/*.spec.ts"
```

**Tests a agregar:** casos `RECOJO` en las clases anteriores (espaciado de llamadas, sanción solo con cobro en efectivo, `clienteId=0`), reposición de stock al cancelar por llamadas, reenvío en `confirmar`, y specs de `cajero-recojo-tab`, `cajero-llamadas-tab` y `cajero-mostrador-modal`.
