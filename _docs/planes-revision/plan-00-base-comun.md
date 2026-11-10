# Plan 00: Base común de los planes de revisión

**Audiencia:** responsables de los Planes 1 a 6.
**Propósito:** fijar los hechos del sistema, las reglas de trabajo y las fronteras entre planes. Cada plan asume este documento.
**Fuente:** auditoría estática del código del 2026-11-09. No se ejecutaron tests ni la aplicación durante la auditoría.

---

## 1. Principios

1. **No agregar complejidad.** No se incorporan colas, gateway, Flyway, STOMP en el frontend ni servicios nuevos. La única tabla nueva es `libro_reclamaciones` (Plan 5).
2. **El backend impone las reglas de negocio** siempre que el dato esté disponible en ese servicio. Una regla que queda solo en la UI se declara como tal.
3. **Cada flujo se certifica de punta a punta:** BD, backend y frontend.
4. **Leyenda de estado:** `Existe` (certificar), `Corregir` (existe con defecto), `Nuevo` (por construir).

---

## 2. Arquitectura real

| Tema | Estado verificado |
| :--- | :--- |
| Base de datos | Una sola BD PostgreSQL `polleria` compartida por todos los servicios. No hay transacciones entre servicios. |
| Esquema | `spring.jpa.hibernate.ddl-auto=update`. No hay Flyway. |
| Entrada HTTP | No hay API gateway. El frontend llama a cada servicio por puerto (`environment.ts`, `proxy.conf.json`). |
| Comunicación interna | REST síncrono con `RestClient`, y `@Async` en `NotificadorOrden`. Cabecera `X-Internal-Key`. |
| Tiempo real | **Polling.** KDS y delivery 2,5 s, salón 6 s, cajero 15 s. El backend publica tópicos STOMP en `/ws-polleria`, pero el frontend no tiene cliente. |
| Orquestación del cobro | La hace el navegador en `cajero-dashboard.component.ts`. No existen las llamadas payments→finance ni orders→finance. |

### Servicios y tablas

| Servicio | Puerto | Tablas |
| :--- | :--- | :--- |
| `auth-service` | 8081 | `users`, `refresh_tokens`, `two_factor_tokens`, `ip_blacklist`, `sanciones_cliente` |
| `orders-service` | 8082 | `mesas`, `zonas_salon`, `ordenes`, `orden_items`, `productos`, `codigos_seguimiento`, `contador_pedido` |
| `payments-service` | 8083 | `pagos` |
| `feedback-service` | 8085 | `reportes_incidencia`, `resenias`, `libro_reclamaciones` (nueva, Plan 5) |
| `finance-service` | 8087 | `arqueos_caja`, `movimientos_caja`, `comprobantes_pago`, `liquidaciones_repartidores`, `cobros_repartidores` |
| `incident-service` | 8088 | `incidentes` |
| `notification-service` (Node) | — | `notification_log`, `conversation_state` |

### Vocabulario oficial

| Concepto | Valores reales |
| :--- | :--- |
| Roles | `CLIENTE`, `MOZO`, `COCINA`, `ADMIN`, `REPARTIDOR`, `CAJERO`. El frontend mapea `COCINA` a `CHEF`. No existe `COCINERO`. |
| Tipo de orden | `SALON`, `DELIVERY`, `RECOJO`. `MOSTRADOR` no es un tipo: es un rótulo derivado de `RECOJO` con `canalOrigen=SALON`. |
| Estado de orden | `RECIBIDO`, `PENDIENTE_CONFIRMACION`, `PENDIENTE_PAGO`, `EN_PREPARACION`, `PREPARANDO`, `LISTO`, `LISTO_PARA_ENTREGAR`, `EN_CAMINO`, `EN_PUERTA`, `ENTREGADO`, `CANCELADO`, `PEDIDO_FANTASMA`. |
| Estado de mesa | `LIBRE`, `RESERVADA`, `OCUPADA`, `POR_COBRAR`, `EN_LIMPIEZA`. |

Los criterios de aceptación usan los nombres del backend. `PAGADO`, `LISTO_COCINA`, `EN_REPARTO` y `COMPLETADO` son alias del adaptador del frontend; `PAGADO` equivale a `RECIBIDO` y no significa "cobrado".

---

## 3. Reglas de cambio

### Base de datos

- Solo se agregan columnas nullable. No se renombran ni eliminan columnas.
- `ddl-auto=update` no crea índices parciales, no agrega unicidad a tablas existentes y no quita `NOT NULL`. Esos cambios van en una clase `Inicializador*`, con el patrón de `InicializadorIndicesUnicos`.
- Antes de crear un índice único se debe comprobar que no haya duplicados. Si los hay, el inicializador registra un error en el log y no detiene el arranque.
- Un valor nuevo de un enum persistido exige ampliar su `CHECK` con el patrón de `InicializadorEstadoOrdenCheck`. Estos planes no agregan valores.

### Backend

- `hasAuthority('X')` es suficiente: los filtros JWT otorgan el rol con y sin prefijo `ROLE_`.
- El identificador de usuario se obtiene de `authentication.getCredentials()` y el email de `authentication.getName()`.
- Los conflictos de estado responden 409 con el mensaje de negocio. No se unifica el formato de error entre servicios.
- Las validaciones de disponibilidad y stock siguen respondiendo **400**, porque `OrdenStockTest`, el checkout y el bot ya dependen de ese contrato.

### Frontend

- Los estados y roles nuevos pasan por `core/adapters` y `api-contracts.model.ts`.
- `mensajeError` se extrae a `core/utils/api-error.ts` (responsable: Plan 3).
- Ante un 409 se muestra el mensaje del backend y se recarga el estado.

---

## 4. Propiedad de archivos compartidos

| Archivo o área | Dueño | Regla para los demás planes |
| :--- | :--- | :--- |
| `cajero-dashboard.component.ts` y su spec | Plan 3 | Plan 2 y Plan 4 agregan componentes nuevos y solo registran su pestaña o modal. |
| `cajero-recojo-tab`, `cajero-llamadas-tab` | Plan 2 | Plan 3 entrega el input `cajaAbierta`. |
| `OrdenService`, `OrdenController` | Por método: Plan 1 (`agregarItems`, `marcarServido`, anulación de ítem, ramas `SALON`), Plan 2 (recojo, llamadas, fantasma, `crear` de mostrador), Plan 4 (bloqueo, descuento y reposición de stock) | PR cortos y rebase antes de integrar. |
| `ProductoController`, `ProductoService`, `Producto` | Plan 4 | Plan 1 solicita agregar `COCINA` en `PATCH /productos/{id}/disponibilidad`. |
| `kitchen-order-card`, `kitchen-kds`, `mozo-menu-picker` | Plan 1 | Plan 2 define la regla del rótulo `MOSTRADOR`. Plan 4 entrega `imagenUrl`. |
| `products.service.ts`, `product.adapter.ts` | Plan 4 | Plan 1 solo consume `loadProducts`. |
| `PagoService`, `PagoController` | Plan 3 | Plan 2 aporta el reenvío de notificación en `confirmar`. Plan 4 aporta `reembolsar`. Plan 6 aporta lo de Mercado Pago y retira `yape-otp`. |
| `MercadoPagoGateway`, `MercadoPagoWebhookController`, `checkout-status` | Plan 6 | Plan 4 entrega la lógica de reembolso. |
| `checkout.component.ts` | Plan 6 | Plan 3 solicita corregir el desglose de IGV. |
| `deploy-gcp-cloudrun.ps1` | Plan 6 | Plan 5 solo agrega las variables de correo de feedback. |
| `docker-compose.local.yml`, dependencias de MinIO | Plan 4 | Plan 5 solo agrega las variables de correo al bloque de feedback. |
| `footer.component.ts`, modal del Libro | Plan 5 | — |
| `admin-feedback.page.ts` | Plan 4 | Plan 5 solo registra la pestaña Libro. |

---

## 5. Fronteras entre planes

| Frontera | Responsable | Contrato |
| :--- | :--- | :--- |
| Cobro de comanda y cierre de orden y mesa | Plan 3 | Plan 1 publica `mesaEstado` en `OrdenResponse` y exige mesa `POR_COBRAR` para `ENTREGADO`. Plan 3 filtra el POS y cierra. |
| Cobro en ventanilla de recojo | Plan 2 decide el momento; Plan 3 registra | Plan 3 entrega `registrarVentaEnCaja(ordenId, datosFiscales, ingresoCaja)`. |
| `disponible` frente a `stock` | Plan 4 (semántica); Plan 1 (toggle en KDS) | `stock=null` significa sin control. Llegar a 0 apaga el plato. Reponer solo reactiva si el plato se apagó por stock 0. |
| Reembolso en efectivo | Plan 4 | Usa sin cambios `POST /finanzas/caja/movimientos` de Plan 3. |
| Reposición de stock | Plan 4 (motor); Plan 2 (caso de llamadas) | Plan 2 agrega el test de su camino. |
| Efectivo del repartidor | Plan 3 | Plan 2 certifica el estado del pedido. |
| Delivery, bot de WhatsApp, checkout y seguimiento | Plan 2 (prueba de humo) | Sin cambios funcionales en esta revisión. |
| Libro de Reclamaciones frente a reclamo postventa | Plan 5 y Plan 4 | Flujos independientes. Una hoja del Libro no mueve dinero ni usa evidencias. |
| Pago web con Mercado Pago frente a cobro presencial | Plan 6 y Plan 3 | Plan 6 no toca el POS. Comparten `PagoService`. |

---

## 6. Orden de integración

1. **Plan 3, primera entrega:** cambios de BD en finance, `emitir` con `ingresoCaja`, helper del frontend e input `cajaAbierta`.
2. **Plan 1, primera entrega:** `mesaEstado`, guardas de `POR_COBRAR` y de `ENTREGADO`.
3. **Plan 3, segunda entrega:** filtro del POS y reintento de cierre.
4. **Plan 2:** mostrador, recojo y prueba de humo.
5. **Plan 1, segunda entrega:** rondas, anulación y agotado en KDS.
6. **Plan 4:** puede avanzar en paralelo. Integra el stock después del paso 5.
7. **Plan 5:** independiente de los demás. Solo requiere rebase sobre los cambios del Plan 4 en `feedback-service` y en el compose.
8. **Plan 6:** el retiro de `yape-otp` se integra de inmediato. El resto, después de `reembolsar` (Plan 4) y del control de dueño en `GET /pagos` (Plan 3).

---

## 7. Entorno y comandos comunes

```bash
cd polleria
docker compose -f docker-compose.local.yml up -d --build
docker exec polleria-postgres psql -U postgres -c "CREATE DATABASE polleria_test"
```

- Las pruebas de integración de `orders-service` usan `polleria_test` en el puerto 5433 y **se omiten en silencio** si la base no está disponible. Una corrida en verde no es válida sin confirmar que se ejecutaron.
- En PowerShell se usa `.\mvnw.cmd` y se mantienen las comillas en `-Dtest`.
- En `ng test`, `--include` se repite por patrón. Separarlos con coma no funciona.
- No usar `-Dsurefire.failIfNoSpecifiedTests=false`: oculta nombres de test equivocados.
- **Antes de reconstruir `notification-service` hay que coordinarlo:** los ajustes del panel viven en memoria y se pierden al reiniciar.

---

## 8. Límites y riesgos aceptados

| Tema | Decisión |
| :--- | :--- |
| Facturación electrónica | No hay envío a SUNAT ni OSE, firma, anulación ni nota de crédito. El comprobante es interno y no debe rotularse "ELECTRÓNICA". |
| Coherencia entre servicios | El navegador orquesta el cobro. Se mitiga con idempotencia y reintento, sin transacción distribuida. |
| Compuerta de caja al cobrar | Es de UI, con consulta fresca de la caja. Forzarla en `payments-service` crearía una dependencia circular con finance. |
| Almacenamiento en producción | MinIO se certifica en el `docker-compose.local.yml`. Para producción se desplegará más adelante en Google Cloud Storage (Plan 4, D4.12). |
