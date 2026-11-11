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
| D3.14 | La bandeja del POS lista solo comandas con `mesaEstado=POR_COBRAR`. Si la respuesta no trae `mesaEstado`, conserva el comportamiento actual. La rama tolerante vive en el adaptador y se retira cuando el Plan 1 lo publique. | Hoy lista todo `SALON` activo. La tolerancia evita bloquear la entrega por el avance del Plan 1. |
| D3.15 | `emitir` ignora el `total` del navegador. Lo obtiene de una `FuenteTotalComprobante`: el monto del pago `APROBADO` de la orden y, si no existe, el total de la orden. | El navegador no puede alterar el monto. El segundo caso cubre la boleta del delivery contraentrega, que se emite al confirmar la llamada, antes del cobro. |
| D3.16 | finance lee la orden con un `OrdenesClient` nuevo, de solo lectura, sobre `GET /ordenes/{id}` con `X-Internal-Key`. | El endpoint ya acepta la clave interna: orders-service no cambia. No crea dependencia circular. |
| D3.17 | El reintento del cobro se deriva del backend: pago `APROBADO`, existencia del comprobante y estado de la orden. El navegador no guarda estado propio. | Sobrevive a una recarga y a un cambio de cajero. Solo se consulta para comandas `SALON` con pago `APROBADO`. |
| D3.18 | La emisión se autoriza con `@PreAuthorize("hasAnyAuthority('ADMIN','CAJERO','INTERNAL')")` y se retira el `permitAll` de `POST /finanzas/comprobantes`. | Hoy la autorización es manual en el controller. Unifica el patrón con payments. |
| D3.19 | Las extensiones son aditivas (Open/Closed): `ingresoCaja` es opcional y por defecto `false`; la lógica nueva va en componentes propios (`ValidadorDatosFiscales`, `GeneradorCorrelativo`, `RegistradorIngresoCaja`, `AutorizacionPago`) y `ComprobanteService.emitir` y `PagoController` solo los coordinan. | `PagoService` y `cajero-dashboard` son compartidos con los Planes 2, 4 y 6. Cambios mínimos en ellos reducen conflictos al integrar. |

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
| ¿De dónde sale el total del comprobante? | Del `total` que envía el navegador. | D3.15 y D3.16. |
| ¿Toda emisión tiene un pago aprobado? | No: `confirmarLlamadaPedido` emite la boleta del delivery contraentrega antes del cobro. | D3.15 usa el total de la orden en ese caso. |
| ¿Quién consume `COCINA` en la emisión y `MOZO` en `POST /pagos`? | Nadie: solo `cajero-dashboard` emite, e `iniciarPago` lo usan el cajero y el checkout (`CLIENTE`). El bot sube comprobantes por `/pagos/orden/{id}/comprobante`. | Se retiran sin romper consumidores. |
| ¿Cómo se protege `POST /finanzas/comprobantes`? | `permitAll` en `SecurityConfig` y control manual en el controller. La vía `X-Internal-Key` solo la usa `test_lifecycle.ps1`. | D3.18. |

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

**Pasos pendientes (D3.17):** la fachada los calcula consultando el backend, sin estado local:

| Pago `APROBADO` | Comprobante | Orden | Pendiente |
| :-- | :-- | :-- | :-- |
| No | — | Activa | Cobrar (pasos 2 a 5) |
| Sí | No existe | Activa | Emitir y cerrar (pasos 4 y 5) |
| Sí | Existe | Activa | Cerrar (paso 5) |
| Sí | Existe | `ENTREGADO` | Nada; sale de la bandeja |

**Total del comprobante (D3.15):** en el paso 4, finance toma el monto del pago `APROBADO` con `PagosClient`. El `total` que envía el navegador se ignora.

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
| `ComprobanteService.emitir` | Coordina los componentes de D3.19: total de D3.15, validación de D3.8, correlativo de D3.4 e `INGRESO` también si el comprobante ya existía. Con `ingresoCaja=true` y sin caja, 409. | Corregir |
| `EmitirComprobanteRequest` | Campo `ingresoCaja` opcional. `total` deja de ser obligatorio y se ignora (D3.15). | Corregir |
| `FuenteTotalComprobante` | Interfaz con el orden de D3.15: pago `APROBADO` y, si no hay, total de la orden. | Nuevo |
| `OrdenesClient` (finance) | `GET /ordenes/{id}` con `X-Internal-Key`, mismo patrón que `PagosClient`. | Nuevo |
| `PagosClient` | Método para el pago de una orden (`GET /pagos/orden/{id}`), reenviando el JWT del emisor. | Corregir |
| `ValidadorDatosFiscales` | Una regla por `TipoComprobante` (D3.8). | Nuevo |
| `GeneradorCorrelativo` | `pg_advisory_xact_lock` por tipo y siguiente número (D3.4). Reemplaza el `COUNT+1`. | Nuevo |
| `RegistradorIngresoCaja` | `INGRESO` idempotente por `orden_id`; 409 sin caja abierta. | Nuevo |
| `InicializadorIndicesFinanzas` | Índices de la tabla anterior, con el patrón del Plan 00. | Nuevo |
| `ComprobanteController`, `SecurityConfig` | D3.18, `usuarioId` del JWT (retira el `1L`), emisión sin `COCINA`, aplica D3.5. | Corregir |
| `AutorizacionPago` | Control de dueño de D3.7, invocado por `PagoController`; Plan 6 lo reutiliza en `sincronizar`. | Nuevo |
| `CajaController`, `LiquidacionController` | Quitan los fallbacks a `1L`. | Corregir |
| `CajaService.cerrar` | Observación obligatoria si `diferencia != 0`, registra `cerrado_por`. | Corregir |
| `LiquidacionService` | Bloqueo pesimista al cerrar y 409 sin caja abierta. | Corregir |
| `PagoController` / `PagoService` | Delegar D3.7 en `AutorizacionPago`, retirar `MOZO` de `iniciar` (sin consumidores) y una guarda al inicio de `iniciar` que valida el monto contra la orden con el `OrdenesClient` existente. Sin otros cambios: el archivo es compartido. | Corregir |
| `FinanzasService` | Ventas en efectivo = `INGRESO` menos fondos; excluir fondos de gastos; contar y sumar con `comprobantes_pago`; quitar `arqueos*35`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `finance.service.ts` | Helper `registrarVentaEnCaja`. | Nuevo |
| `CobroSalonFacade` | Orquesta los pasos de 4.1 y calcula los pendientes de D3.17. `cajero-dashboard` solo le delega `confirmarYRegistrar`. | Nuevo |
| Adaptador de órdenes | Filtro tolerante de D3.14. | Corregir |
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
| R3.11 | Total confiable | Una emisión con `total` alterado en el request usa el monto del pago `APROBADO`. Sin pago aprobado (delivery contraentrega), usa el total de la orden. |
| R3.12 | Reintento sin estado local | Con pago `APROBADO` y comprobante emitido, recargar la página y reintentar solo cierra la orden: no crea otro pago, comprobante ni `INGRESO`. |
| R3.13 | Filtro tolerante | Sin `mesaEstado` en la respuesta, el POS lista todo `SALON` activo. Con `mesaEstado`, solo `POR_COBRAR`. |
| R3.14 | Autorización de emisión | Sin JWT ni clave interna: 403 (finance no define un punto de entrada 401 y este Plan no cambia ese comportamiento global). `CLIENTE`, `MOZO` o `COCINA`: 403. `ADMIN`, `CAJERO` o clave interna: 201. |

---

## 7. Contratos con otros planes

- **Recibe de Plan 1:** `mesaEstado` y la guarda de `ENTREGADO`.
- **Entrega a Plan 2:** `registrarVentaEnCaja`, `cajaAbierta`, `cajero-datos-fiscales`.
- **Entrega a Plan 2:** `confirmarLlamadaPedido` sigue funcionando sin cambios (D3.15 cubre la emisión sin pago). Se recomienda migrarlo a `registrarVentaEnCaja`.
- **Entrega a Plan 4:** `POST /finanzas/caja/movimientos` sin cambios, con 409 si la caja está cerrada.
- **Entrega a Plan 6:** `AutorizacionPago` (D3.7) para `sincronizar`.
- **Solicita a Plan 4:** `ORDERS_SERVICE_URL` en el bloque de finance de `docker-compose.local.yml`.
- **Solicita a Plan 6:** `ORDERS_SERVICE_URL` para finance en `deploy-gcp-cloudrun.ps1`.
- **`mensajeError`:** este Plan crea `core/utils/api-error.ts` y migra solo sus archivos. Cada dueño migra los suyos (`orders.service`, `checkout`, `admin-ordenes`) en su propio PR.

---

## 7.1 Entregas

| PR | Contenido | Depende de |
| :-- | :-- | :-- |
| 1 | Índices e inicializador; `emitir` con `ingresoCaja` y los componentes de D3.19; `FuenteTotalComprobante` y `OrdenesClient`; D3.5 a D3.7 y D3.18; `registrarVentaEnCaja`, `CobroSalonFacade`, input `cajaAbierta` y `api-error.ts`. | — |
| 2 | Caja y arqueo ciego, liquidación, reportes de `FinanzasService`, ticket real y desglose de IGV del checkout. | PR 1 |
| 3 | Filtro tolerante de D3.14 y reintento de D3.17. | PR 1 |

El PR 1 corresponde a la primera entrega del Plan 00 (sección 6) y destraba a los Planes 2 y 6. El PR 3 no espera al Plan 1 gracias a D3.14.

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

**Tests a ampliar o crear:** `ComprobanteServiceTest` (validaciones, idempotencia, `ingresoCaja`, total de D3.15), `CajaServiceTest` (observación obligatoria), `PagoServiceTest` (D3.7 y validación de monto), tests de `FuenteTotalComprobante`, `GeneradorCorrelativo` y `OrdenesClient`, un test de seguridad de la emisión (R3.14), el spec de `CobroSalonFacade` (tabla de pendientes de 4.1) y el nuevo `admin-finanzas.page.spec.ts`.

**Fuentes normativas:** [R.S. 303-2018/SUNAT](https://ww3.sunat.gob.pe/legislacion/superin/2018/anexo-303-2018.pdf), [Preguntas frecuentes de SUNAT](https://orientacion.sunat.gob.pe/node/462).
