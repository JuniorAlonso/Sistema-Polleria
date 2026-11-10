# Plan de Revisión 3: Pagos, Caja, Comprobantes y Liquidaciones

**Responsable:** Compañero 3
**Servicios:** `payments-service` (8083), `finance-service` (8087), `frontEnd` (`/cajero`, `/admin/finanzas`)
**Tablas:** `pagos`, `arqueos_caja`, `movimientos_caja`, `comprobantes_pago`, `liquidaciones_repartidores`, `cobros_repartidores`
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Certificar el circuito de dinero: cobro en POS, emisión de comprobante, registro en caja, arqueo, liquidación de repartidores y reportes de Admin. Este Plan es dueño del cierre de la orden después del cobro.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D3.1 | El frontend dispara la emisión tras el pago, mediante un único helper `registrarVentaEnCaja`. | Solo el POS tiene el DNI o RUC, y evita crear la dependencia payments→finance. |
| D3.2 | `POST /finanzas/comprobantes` acepta `ingresoCaja` y registra comprobante e `INGRESO` en **una sola transacción**. | Hoy el `INGRESO` es una llamada aparte, sin idempotencia. |
| D3.3 | Un comprobante por orden: unicidad en `orden_id`. | Hoy es posible duplicarlo en una carrera. |
| D3.4 | Correlativo con `pg_advisory_xact_lock` por tipo, al inicio de `emitir`. Los comprobantes no se borran. | `COUNT+1` colisiona; una secuencia dejaría huecos. |
| D3.5 | El `GET /finanzas/comprobantes/orden/{id}` queda solo para `ADMIN` y `CAJERO`. | El sistema no guarda dueño del comprobante (`usuarioId` es el emisor) y ninguna pantalla de cliente lo consume. El cliente y el invitado usan el ticket impreso. |
| D3.6 | `usuarioId` se toma del JWT y representa al **emisor** (`emitidoPor`). Se eliminan los fallbacks a `1L`. | Corrige la auditoría, sin confundirlo con el dueño. |
| D3.7 | En `GET /pagos/{id}` y `GET /pagos/orden/{id}`, un `CLIENTE` solo accede a pagos propios (`pagos.cliente_id`). | Mismo IDOR. El frontend sí consume este endpoint. |
| D3.8 | Boleta a consumidor final por defecto. Si el total **supera S/ 700**, se exige DNI real. Factura exige RUC de 11 dígitos. | Artículo 15 del Reglamento de Comprobantes de Pago, según la R.S. 303-2018/SUNAT. |
| D3.9 | Los precios incluyen IGV: `base = total/1.18` (HALF_UP, 2 decimales), `igv = total - base`. | Es el cálculo actual, garantiza `base + igv = total`. |
| D3.10 | Se elimina el hash SHA-256 del plan. | No existe y, sin firma ni envío a SUNAT, no aporta. |
| D3.11 | Una sola caja global abierta, garantizada por índice único parcial. | Hoy solo la protege una comprobación. |
| D3.12 | El arqueo ciego es de UI: sin esperado ni diferencia hasta confirmar. | El backend ya calcula al cerrar. |
| D3.13 | Tarjeta y Yape en POS son confirmación manual y no entran al efectivo esperado. | Comportamiento actual, ahora explícito. |
| D3.14 | La bandeja del POS lista solo comandas con `mesaEstado=POR_COBRAR`. | Hoy lista todo `SALON` activo. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿Basta tomar el usuario del JWT para cerrar el IDOR? | No. `usuarioId` es el emisor; `pagos.cliente_id` guarda a quien llama y `ordenes.cliente_id` al mozo en salón. | D3.5 y D3.6. |
| ¿Qué ve el cajero si el pago se aprueba y la emisión falla? | Mensaje sin función real ("Emítela desde Arqueo") y la comanda desaparece. | "Pago OK, comprobante pendiente" con reintento. |
| ¿Y si falla el cierre de la orden? | La orden queda pagada y activa, y el POS la oculta. | El POS conserva `SALON` con pago `APROBADO` no terminal y ejecuta lo pendiente. |
| ¿Un cobro con total desactualizado? | `iniciar` no compara con la orden. | Validar monto contra la orden; si difiere, 409. |
| ¿La compuerta de caja existe? | Solo un aviso; el botón no depende de la caja. | Consulta fresca antes de cobrar en efectivo; `emitir` responde 409 sin caja. |
| ¿`totalEsperado` incluye tarjeta? | No: apertura + `INGRESO` − `EGRESO`, y el `INGRESO` es solo efectivo. | Correcto; certificar. |
| ¿Es ciego el arqueo? | No: muestra esperado y diferencia, y precarga el input. | D3.12. |
| ¿Las observaciones son obligatorias? | No, ni en UI ni en backend. | 400 si hay diferencia y no hay texto, sin revelar el monto. |
| ¿La liquidación entra a caja? | Solo si está abierta; si no, se pierde. | 409 sin caja abierta. |
| ¿El monto del modal de liquidación es correcto? | No: usa un acumulado que queda en 0 y fuerza una discrepancia falsa. | Precargar desde `GET /finanzas/liquidaciones/repartidor/{id}/pendiente`. |
| ¿Admin Finanzas cuadra? | No: incluye fondos, estima órdenes con `arqueos*35` y afirma una conciliación falsa. | Sección 5. |

---

## 4. Flujos de datos

### 4.1 Cobro de comanda en POS

| # | Paso | Frontend | Backend | BD |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Listar | `comandasPorCobrar` filtra `mesaEstado=POR_COBRAR` | `GET /ordenes` | `ordenes`, `mesas` |
| 2 | Datos fiscales | `cajero-cobro-modal`: consumidor final o DNI/RUC; consulta `GET /finanzas/caja/actual` si es efectivo | — | `arqueos_caja` |
| 3 | Cobrar | `iniciarPago` + `confirmarPago` | Valida monto contra orden | `pagos.estado=APROBADO` |
| 4 | Comprobante y caja | `registrarVentaEnCaja` | Bloqueo, correlativo e `INGRESO` en una transacción | `comprobantes_pago`, `movimientos_caja` |
| 5 | Cerrar | `completarOrdenSalon` | `PATCH /ordenes/{id}/estado` con `ENTREGADO` | `ordenes.estado`, `mesas.estado=LIBRE` |
| 6 | Ticket | `cajero-ticket-modal` con los valores de la respuesta | — | — |

**Fallo parcial:** si el paso 4 o 5 falla, la comanda permanece en el POS con pago `APROBADO` y al reintentar se ejecutan solo los pasos pendientes. Es seguro porque `emitir` es idempotente por orden.

### 4.2 Caja

| Paso | Frontend | Backend | BD |
| :--- | :--- | :--- | :--- |
| Abrir | Fondo inicial | Índice único; segunda apertura 409 | `arqueos_caja` (`ABIERTA`) |
| Movimiento | Modal de movimientos | `POST /finanzas/caja/movimientos`; caja cerrada 409 | `movimientos_caja` |
| Cerrar | Input vacío, sin esperado | Calcula `diferencia`, exige observación, registra quién cerró | `arqueos_caja` (`CERRADA`) |
| Resultado | Muestra esperado y diferencia recién al cerrar | Respuesta del cierre | — |

### 4.3 Liquidación de repartidor

`GET /finanzas/liquidaciones/repartidor/{id}/pendiente` → modal precargado → cierre con bloqueo de la liquidación y 409 sin caja abierta → `liquidaciones_repartidores`, `cobros_repartidores`, `pagos.liquidacion_id`, `movimientos_caja` (`INGRESO`). El monto esperado es fondo + pagos `CONTRAENTREGA` aprobados sin liquidar; el vuelto queda neutralizado porque el pago guarda el total.

---

## 5. Cambios por capa

### Base de datos

Con `Inicializador*` donde corresponda (Plan 00, sección 3).

| Cambio | Tipo |
| :--- | :--- |
| Índice único `comprobantes_pago(orden_id)` | Nuevo |
| Índice único parcial `arqueos_caja(estado) WHERE estado='ABIERTA'` | Nuevo |
| `movimientos_caja.orden_id BIGINT NULL` con índice único parcial `WHERE orden_id IS NOT NULL AND tipo='INGRESO'` | Nuevo |
| `arqueos_caja.cerrado_por BIGINT NULL` | Nuevo |

### Backend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `ComprobanteService.emitir` | Advisory lock, validación de D3.8, `ingresoCaja` e `INGRESO` también si el comprobante ya existía. Con `ingresoCaja=true` y sin caja, 409. | Corregir |
| `ComprobanteController` | `usuarioId` del JWT, emisión solo `ADMIN` y `CAJERO` (retirar `COCINA`), aplica D3.5. | Corregir |
| `CajaController`, `LiquidacionController` | Quitan los fallbacks a `1L`. | Corregir |
| `CajaService.cerrar` | Observación obligatoria si `diferencia != 0`, registra `cerrado_por`. | Corregir |
| `LiquidacionService` | Bloqueo pesimista al cerrar y 409 sin caja abierta. | Corregir |
| `PagoController` / `PagoService` | D3.7, retirar `MOZO` de `iniciar` (sin consumidores), validar monto contra la orden. | Corregir |
| `FinanzasService` | Ventas en efectivo = `INGRESO` menos fondos; excluir fondos de gastos; contar y sumar con `comprobantes_pago`; quitar `arqueos*35`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `finance.service.ts` | Helper `registrarVentaEnCaja`. | Nuevo |
| `cajero-datos-fiscales` | Consumidor final, DNI o RUC, reutilizable por Plan 2. | Nuevo |
| `core/utils/api-error.ts` | `mensajeError` extraído. | Nuevo |
| `cajero-dashboard` (`confirmarYRegistrar`) | Orden de pasos de 4.1, reintento y estado "comprobante pendiente". | Corregir |
| `cajero-cobro-modal`, `cajero-pos-tab` | Bloqueo sin caja y datos fiscales. | Corregir |
| `cajero-ticket-modal` | Valores reales, sin `B001-{ordenId}` falso ni la palabra "ELECTRÓNICA". | Corregir |
| `cajero-cierre-modal` | Input vacío y arqueo ciego. Exige motivo al recibir el 400. | Corregir |
| `cajero-cierre-liquidacion-modal` | Precarga desde `/pendiente`. | Corregir |
| `admin-finanzas.page`, `cash-summary` | Cálculo igual al del cajero, sin leyenda de conciliación ni "sin novedades" por defecto. | Corregir |
| `checkout.component` | Corrige `subtotal*0.82` con la fórmula de D3.9. | Corregir |

---

## 6. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R3.1 | Apertura | Crea `ABIERTA`. Dos aperturas simultáneas: una responde 409. |
| R3.2 | Cobro y boleta | Comanda en `POR_COBRAR`: un pago, una boleta `B001-…`, un `INGRESO` si es efectivo, orden `ENTREGADO`, mesa `LIBRE`. El ticket muestra la serie real. |
| R3.3 | Datos fiscales | Factura sin RUC de 11 dígitos: 400. Serie `F001-…` con RUC válido. Boleta con total > S/ 700 sin DNI real: 400. Con S/ 700 exactos se acepta consumidor final. |
| R3.4 | Protección de datos | `CLIENTE` en `GET /finanzas/comprobantes/orden/{id}`: 403. `ADMIN` y `CAJERO`: 200. `CLIENTE` en pago ajeno: 403. |
| R3.5 | Concurrencia | Dos emisiones simultáneas de órdenes distintas no colisionan. Dos de la misma orden devuelven un solo comprobante y un `INGRESO`. |
| R3.6 | Fallo parcial | Si falla la emisión o el cierre, la comanda sigue visible y reintentar completa sin duplicar. |
| R3.7 | Compuerta | Sin caja, el efectivo queda bloqueado en POS. Tarjeta y Yape siguen disponibles. |
| R3.8 | Arqueo | No se muestra el esperado antes de confirmar. `esperado = apertura + INGRESO − EGRESO`. Con `diferencia = -5.00` y sin observación: 400; con observación: cierra con `diferencia = -5.00`. |
| R3.9 | Liquidación | Sin caja: 409. Con caja: precarga el monto correcto, registra un `INGRESO` y no permite liquidar dos veces. |
| R3.10 | Reportes | Los totales de Admin coinciden con `movimientos_caja` y `comprobantes_pago` de un día de prueba. |

---

## 7. Contratos con otros planes

- **Recibe de Plan 1:** `mesaEstado` y la guarda de `ENTREGADO`.
- **Entrega a Plan 2:** `registrarVentaEnCaja`, `cajaAbierta`, `cajero-datos-fiscales`.
- **Entrega a Plan 4:** `POST /finanzas/caja/movimientos` sin cambios, con 409 si la caja está cerrada.

---

## 8. Alcance

**Incluye:** pagos en POS, comprobantes, caja, liquidaciones y reportes.

**No incluye:** integración con Mercado Pago ([Plan 6](../Altamirano/plan-06-mercado-pago.md)), envío a SUNAT u OSE, anulación y nota de crédito, efecto fiscal de un reembolso, comprobante del delivery prepagado, vista de comprobantes para clientes.

---

## 9. Verificación

```bash
cd polleria
./mvnw test -pl payments-service,finance-service "-Dtest=PagoServiceTest,CajaServiceTest,ComprobanteServiceTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/cajero/**/*.spec.ts" --include="src/app/features/admin/pages/finanzas/**/*.spec.ts"
```

**Tests a ampliar o crear:** `ComprobanteServiceTest` (validaciones, idempotencia, `ingresoCaja`), `CajaServiceTest` (observación obligatoria), `PagoServiceTest` (D3.7 y validación de monto) y el nuevo `admin-finanzas.page.spec.ts`.

**Fuentes normativas:** [R.S. 303-2018/SUNAT](https://ww3.sunat.gob.pe/legislacion/superin/2018/anexo-303-2018.pdf), [Preguntas frecuentes de SUNAT](https://orientacion.sunat.gob.pe/node/462).
