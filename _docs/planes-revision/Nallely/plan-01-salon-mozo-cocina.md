# Plan de Revisión 1: Salón, Mozos, Mesas y Cocina KDS

**Responsable:** Compañero 1
**Servicios:** `orders-service` (8082), `frontEnd` (`/mozo`, `/cocina`)
**Tablas:** `mesas`, `zonas_salon`, `ordenes`, `orden_items`, `productos`
**Base obligatoria:** [Plan 00](../plan-00-base-comun.md)

---

## 1. Objetivo

Certificar el ciclo completo de atención en salón: apertura de comanda, rondas, preparación en KDS, servicio en mesa, agotado de platos y solicitud de cobro. El Plan termina cuando la mesa queda en `POR_COBRAR`; el cobro corresponde al Plan 3.

---

## 2. Decisiones

| ID | Decisión | Justificación |
| :--- | :--- | :--- |
| D1.1 | El mozo no cobra. Su última acción es pasar la mesa a `POR_COBRAR`. | Segregación de funciones. |
| D1.2 | `ENTREGADO` y `CANCELADO` de una orden `SALON` solo los ejecutan `CAJERO`, `ADMIN` o una llamada con clave interna. `ENTREGADO` exige además mesa en `POR_COBRAR`. | Hoy `MOZO` y `COCINA` pueden cerrar sin pago. |
| D1.3 | El polling es el mecanismo oficial de actualización. No se agrega STOMP al frontend. | Ya funciona y recupera el estado completo tras un corte. |
| D1.4 | Se cierra el acceso anónimo a `/ws-polleria/**`. | No tiene consumidores y difunde nombre y total de pedidos. |
| D1.5 | Las rondas se identifican con `orden_items.ronda`. No se agrega estado por ítem. | Es el mínimo que permite distinguir la adición en KDS. |
| D1.6 | Se exige comanda lista y servida para pedir el cobro. "Servir" deja de pasar la mesa a `POR_COBRAR`. | Evita cobrar platos que siguen en cocina. |
| D1.7 | Tras el cobro la mesa pasa a `LIBRE`. `EN_LIMPIEZA` queda fuera del flujo normal. | La transición ya existe y `LIBRE→EN_LIMPIEZA` es inválida. |
| D1.8 | Quitar un ítem: `MOZO` solo con orden `RECIBIDO`; `ADMIN` en cualquier estado activo. | Sin esto, un error de toma se cobra igual. |

---

## 3. Preguntas críticas resueltas

| Pregunta | Hallazgo | Resolución |
| :--- | :--- | :--- |
| ¿La segunda ronda se distingue en KDS? | No. `orden_items` no tiene ronda ni fecha. | Columna `ronda` y badge en la tarjeta. |
| ¿Se puede servir una segunda ronda? | No. `servidoEn` se conserva y el `return` temprano de `marcarServido` lo impide. | `agregarItems` limpia `servidoEn` y `servidoPor`. |
| ¿Qué pasa si llega una ronda con la mesa en `POR_COBRAR`? | La mesa no cambia. | `agregarItems` devuelve la mesa a `OCUPADA`. |
| ¿Un doble clic duplica? | Al abrir, el segundo recibe 409. En una ronda sí duplica ítems, total y stock. | Bandera `enviando` en el frontend. |
| ¿Existe el agotado en caliente? | No de punta a punta: el endpoint es solo `ADMIN`, KDS no tiene panel y el picker no deshabilita. | Ver sección 5. |
| ¿Es alcanzable `<1s`? | No. KDS actualiza cada 2,5 s y mesas cada 6 s. | Criterios ajustados al polling. |
| ¿Hay alerta sonora? | No existe audio. | Criterio solo visual. |
| ¿Quién reordena mesas? | La UI solo lo permite a `ADMIN`; el backend también a `MOZO`. | Se restringe el backend a `ADMIN`. |

---

## 4. Flujo de datos

| # | Paso | Frontend | Backend | BD |
| :-- | :--- | :--- | :--- | :--- |
| 1 | Abrir comanda | `mozo-salon`: selección explícita de mesa y bandera `enviando` | `POST /ordenes`, bloqueo pesimista de la mesa | `ordenes` (`tipo=SALON`), `orden_items` (`ronda=1`), `mesas.estado=OCUPADA`, `productos.stock` |
| 2 | Agregar ronda | `mozo-mesa-modal` | `POST /ordenes/{id}/items`, valida `disponible` y stock | `orden_items` (`ronda=max+1`), total, `servido_en=NULL`, `LISTO→EN_PREPARACION`, `POR_COBRAR→OCUPADA` |
| 3 | Preparar | `kitchen-kds` con polling de 2,5 s y badge de ronda | `PATCH /ordenes/{id}/estado` | `ordenes.estado` |
| 4 | Avisar al mozo | Banner y toast con polling de 6 s | Lectura de órdenes y mesas | — |
| 5 | Servir | `POST /ordenes/{id}/servir`, sin cambiar la mesa | `marcarServido` | `ordenes.servido_en`, `servido_por` |
| 6 | Solicitar cobro | `cobrarMesaModal`, muestra el motivo del 409 | `PATCH /mesas/{id}/estado`; exige orden lista y servida | `mesas.estado=POR_COBRAR` |
| 7 | Cierre (Plan 3) | Croquis refleja `LIBRE` | `PATCH /ordenes/{id}/estado` con `ENTREGADO` | `ordenes.estado`, `mesas.estado=LIBRE` |

**Agotar plato:** toggle en KDS → `PATCH /productos/{id}/disponibilidad` → `productos.disponible` → el picker recarga la carta cada 30 s. Si un pedido llega antes de la recarga, el backend lo rechaza con 400.

---

## 5. Cambios por capa

### Base de datos

| Cambio | Tipo |
| :--- | :--- |
| `orden_items.ronda INTEGER NULL`. Un valor nulo se interpreta como ronda 1. | Nuevo |

### Backend (`orders-service`)

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `OrdenService.agregarItems` | Asigna `ronda`, limpia `servidoEn` y `servidoPor`, devuelve la mesa a `OCUPADA` si estaba en `POR_COBRAR`. | Corregir |
| `MesaService` | `POR_COBRAR` con comanda activa exige estado listo y `servidoEn != null`; si no, 409. | Corregir |
| `OrdenController` / `OrdenService.actualizarEstado` | Aplica D1.2. | Corregir |
| `OrdenResponse` | Publica `mesaEstado`. | Nuevo |
| `DELETE /ordenes/{id}/items/{itemId}` | Aplica D1.8. Recalcula el total, repone stock solo si la orden está `RECIBIDO`, responde 409 si es el último ítem y deja nota en `observaciones`. | Nuevo |
| `ProductoController` (vía Plan 4) | Agrega `COCINA` a `PATCH /productos/{id}/disponibilidad`. | Corregir |
| `MesaController` | Actualizar posición solo `ADMIN`. | Corregir |
| `SecurityConfig` | Quita `permitAll` de `/ws-polleria/**`. | Corregir |

### Frontend

| Componente | Cambio | Estado |
| :--- | :--- | :--- |
| `kitchen-kds` | Panel de agotado con `toggleAgotado`. | Nuevo |
| `kitchen-order-card` | Badge de ronda, `track` por id de ítem, rótulo `MOSTRADOR` (`RECOJO` + `canalOrigen=SALON`) y texto correcto para recojo. | Corregir |
| `mozo-menu-picker` | Deshabilita los platos agotados. | Corregir |
| `mozo-salon` | Bandera `enviando`, elimina `selectedMesaForOrder = 1`, recarga la carta cada 30 s, quita el `POR_COBRAR` automático de "Servir". | Corregir |
| `mozo-mesa-modal` | Permite "Servir" en rondas nuevas y agrega "Quitar ítem" según D1.8. | Corregir |
| `salon.service.ts` | Activa `hasError` en el polling y muestra el mensaje real del 409. | Corregir |

---

## 6. Requerimientos y criterios de aceptación

| ID | Requerimiento | Criterio verificable |
| :--- | :--- | :--- |
| R1.1 | Apertura | Con mesa `LIBRE`, al confirmar se crea la orden `SALON`, la mesa pasa a `OCUPADA` y KDS la muestra en ≤3 s. Dos aperturas simultáneas: una responde 409. |
| R1.2 | Rondas | `POST /ordenes/{id}/items` recalcula el total, descuenta stock y KDS muestra la ronda con badge. Una orden `LISTO` vuelve a `EN_PREPARACION`. Una orden terminal responde 409. |
| R1.3 | KDS y aviso | Al pasar a `LISTO`, el mozo ve banner y toast con el número de mesa en ≤7 s con la pestaña visible. |
| R1.4 | Servicio | `POST /ordenes/{id}/servir` registra `servidoEn` y la mesa sigue `OCUPADA`. Una nueva ronda habilita "Servir" otra vez. |
| R1.5 | Agotado | `COCINA` o `ADMIN` desactiva el plato: el picker lo deshabilita en ≤30 s sin recargar. Un pedido del plato responde 400. |
| R1.6 | Solicitud de cobro | Con orden lista y servida la mesa pasa a `POR_COBRAR`. Con platos pendientes o sin servir responde 409 con motivo. |
| R1.7 | Integridad | Por API: `MOZO` o `COCINA` no pueden poner `ENTREGADO` ni `CANCELADO` en `SALON` (403). `ENTREGADO` con mesa fuera de `POR_COBRAR` responde 409. |
| R1.8 | Liberación | Pasar a `LIBRE` con comanda activa responde 409, salvo `forzar` de `ADMIN`. |
| R1.9 | Quitar ítem | `MOZO` con orden `RECIBIDO`: total recalculado y stock repuesto. Con orden en preparación responde 403 o 409. Último ítem: 409. |
| R1.10 | Resiliencia | Tras cortar la red, la UI indica el error y se recupera sola al volver la conexión. |

---

## 7. Contratos con otros planes

- **Entrega a Plan 3:** `OrdenResponse.mesaEstado` y el rechazo de `ENTREGADO` fuera de `POR_COBRAR`.
- **Recibe de Plan 3:** el cierre de la orden, que libera la mesa.
- **Recibe de Plan 4:** `COCINA` en el endpoint de disponibilidad, y `imagenUrl` absoluta.
- **Recibe de Plan 2:** la regla del rótulo `MOSTRADOR`.

---

## 8. Alcance

**Incluye:** mesas, comandas `SALON`, KDS, agotado desde KDS, guardas de cierre.

**No incluye:** cobro y comprobante (Plan 3); recojo, delivery y bot (Plan 2); stock e imágenes (Plan 4); cliente STOMP; persistencia del cambio de zona al arrastrar mesas, que hoy no se guarda y queda como limitación conocida.

---

## 9. Verificación

```bash
cd polleria
./mvnw test -pl orders-service "-Dtest=MesaServiceTest,MesaForzarTest,MesaComandaUnicaTest,MesaComandaUnicaConcurrenteTest,ComandaItemsTest,ServirComandaTest,OrdenColaCocinaTest"
```

```bash
cd frontEnd
npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/mozo/**/*.spec.ts" --include="src/app/features/kitchen/**/*.spec.ts"
```

**Tests a agregar:** rondas (`agregarItems` en cada estado), guarda de `POR_COBRAR`, autorización de `ENTREGADO` y `CANCELADO` en `SALON`, quitar ítem, y specs de `mozo-menu-picker` y de la bandera `enviando`.
