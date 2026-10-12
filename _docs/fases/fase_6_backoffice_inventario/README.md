# 🏢 FASE 6 — Backoffice, Inventario, Finanzas y Seguridad Avanzada

**Objetivo:** Completar las operaciones administrativas y de cadena de suministro de la pollería, consolidar la rentabilidad financiera y blindar el sistema con observabilidad e infraestructura enterprise.

**Prioridad:** Baja — Módulos de soporte y gobierno corporativo una vez estabilizado el flujo transaccional.

---

## 1. Arquitectura General del Backoffice

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 API Gateway / Frontend Admin                           │
└────────┬──────────────────────┬───────────────────────┬──────────────────────┬─────────┘
         │                      │                       │                      │
         ▼                      ▼                       ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐
│ inventory-service│   │ finance-service  │   │ auth-service      │   │ incident-service │
│ :8086            │   │ :8087            │   │ :8081             │   │ :8088            │
│                  │   │                  │   │                   │   │                  │
│ - Insumos & BOM  │   │ - Arqueo de Caja │   │ - Hardening 2FA   │   │ - Registro Fallas│
│ - Despacho Chef  │   │ - Conciliación   │   │ - Unblock IP GUI  │   │ - Causa Raíz     │
│ - Mermas diarias │   │ - Balance Neto   │   │ - Audit Logs      │   │ - Cloud Logging  │
└────────┬─────────┘   └────────┬─────────┘   └─────────┬─────────┘   └────────┬─────────┘
         │                      │                       │                      │
         └──────────────────────┼───────────────────────┴──────────────────────┘
                                ▼
                       PostgreSQL Multi-Schema / RDS
```

| Microservicio | Puerto | Base de Datos | Rol Principal |
| :--- | :---: | :---: | :--- |
| `inventory-service` | `8086` | `polleria` (base única en Docker; base dedicada en RDS) | Control de stock físico, despacho a cocina, registro de mermas y alertas predictivas. |
| `finance-service` | `8087` | `polleria` (base única en Docker; base dedicada en RDS) | Arqueo de caja diaria en salón, conciliación pasarelas vs efectivo y reportes de utilidad. |
| `auth-service` | `8081` | `polleria` (base única en Docker; base dedicada en RDS) | Blindaje de seguridad: panel de gestión de IPs bloqueadas y políticas estrictas de 2FA. |
| `incident-service` | `8088` | `polleria` (base única en Docker; base dedicada en RDS) | Bitácora de incidentes operativos/técnicos, análisis causa raíz y trazabilidad centralizada. |

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código | Tipo | Descripción Oficial | Componente Responsable |
| :--- | :---: | :--- | :--- |
| **RF04** | RF | Verificación en dos pasos (2FA) para el personal y administradores *(base en F1, panel de auditoría en F6)*. | `auth-service` |
| **RF05** | RF | Bloqueo temporal de acceso tras múltiples intentos fallidos *(base en F1, panel de desbloqueo en F6)*. | `auth-service` |
| **RF22** | RF | Registro centralizado de ingresos validados por pasarela o cobrados en caja en módulo Finanzas. | `finance-service` |
| **RF23** | RF | Solicitud y registro de despacho de lotes de insumos hacia cocina por el Chef. | `inventory-service` |
| **RF24** | RF | Registro de mermas de insumos perecibles no vendidos al finalizar la jornada. | `inventory-service` |
| **RF25** | RF | Métricas de rentabilidad y alertas predictivas de abastecimiento cruzando ventas, despachos y mermas. | `inventory-service` + BI |
| **RF34** | RF | Registro y documentación de incidentes técnicos u operativos (causa raíz y solución). | `incident-service` |
| **RNF05** | RNF | Bloqueo automático de IPs sospechosas sin intervención manual. | `auth-service` (`IpBlacklistService`, persistido en la tabla de la entidad `IpBlacklist`) |
| **RNF12** | RNF | Portabilidad multi-entorno (dev, stage, prod) mediante variables de entorno estrictas. | Todos (`.env`, Docker Compose, Cloud Run / EC2) |
| **RNF13** | RNF | Trazabilidad con logs estructurados para auditoría de transacciones y errores. | Todos (SLF4J + Logback con patrón de consola; sin encoder JSON) |

---

## 3. Microservicio de Inventario y Almacén (`inventory-service`)

### 3.1 Insumos, Stock y Despachos
El inventario se administra a nivel de **insumo** (tabla `insumos`), no de receta: `POST /inventario/insumos`, `GET /inventario/insumos`, `GET /inventario/insumos/{id}`, `PATCH /inventario/insumos/{id}/stock` y `DELETE /inventario/insumos/{id}`.

El descuento de insumos ocurre en el **despacho a cocina** (`POST /inventario/despachos`), que registra el `DespachoItem` por insumo y lo descuenta del stock. **No existe todavía una ficha técnica / receta (BOM) por plato** que deduzca insumos automáticamente a partir de una venta en `orders-service`; el consumo se declara manualmente vía despacho o merma.

### 3.2 Entidades Clave

```java
@Entity
@Table(name = "insumos")
public class Insumo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre; // Ej: "Pollo Entero", "Papas Canchan", "Aceite Vegetal"
    private String unidadMedida; // KG, UNIDAD, LITRO, PORCION
    private BigDecimal stockActual = BigDecimal.ZERO;
    private BigDecimal stockMinimoAlerta = BigDecimal.TEN;
    private BigDecimal costoUnitario = BigDecimal.ZERO;
}

@Entity
@Table(name = "despachos_cocina")
public class DespachoCocina {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long solicitanteId;       // Chef ID o Mozo ID
    private String solicitanteNombre;
    private LocalDateTime fechaDespacho = LocalDateTime.now();
    @OneToMany(cascade = CascadeType.ALL)
    private List<DespachoItem> items; // tabla despacho_items
}

@Entity
@Table(name = "mermas")
public class Merma {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long insumoId;
    private String insumoNombre;
    private BigDecimal cantidad;
    @Enumerated(EnumType.STRING)
    private MotivoMerma motivo; // VENCIMIENTO, MAL_ESTADO, ERROR_COCINA, CAIDA, OTRO
    private String justificacion;
    private Long registradoPor;
    private LocalDateTime fecha = LocalDateTime.now();
}
```

### 3.3 Motor de Rentabilidad y Alertas de Stock (RF25)

**Alertas de abastecimiento:** el criterio es un umbral, no una predicción temporal. La consulta
`InsumoRepository.findCriticos()` selecciona `stockActual <= stockMinimoAlerta` y
`InventarioAnalisisService.obtenerAlertasStock()` clasifica cada insumo como `CRITICO`
(stock en cero o negativo) o `ALTO`, generando el mensaje:

```
⚠️ Alerta de abastecimiento: Stock crítico de <insumo>. Quedan <stock> <unidad> (umbral mínimo: <min> <unidad>)
```

**Balance de rentabilidad (`GET /inventario/rentabilidad`):** consolida
`valorTotalInventario` (Σ `stockActual × costoUnitario`), `costoTotalMermas`
(Σ `merma.cantidad × insumo.costoUnitario`), `totalInsumos`, `totalInsumosCriticos` y la lista
`alertasCriticas`. No existe todavía un cruce de consumo real contra consumo teórico de ventas.

---

## 4. Microservicio de Finanzas y Caja (`finance-service`)

### 4.1 Ciclo de Arqueo de Caja (Turnos de Salón)
1. **Apertura de Caja (`POST /finanzas/caja/apertura`):** Monto inicial en efectivo (fondo para vuelto, ej. S/ 200.00).
2. **Registro de Cobros de Salón:** Pagos recibidos en efectivo o POS físico (Izipay/Niubiz).
3. **Movimientos de caja chica (`POST /finanzas/caja/movimientos`):** Ingresos y egresos con `TipoMovimiento` (`INGRESO`, `EGRESO`).
4. **Consulta (`GET /finanzas/caja/actual`, `GET /finanzas/caja/movimientos`, `GET /finanzas/caja/historial`):** Caja abierta (`EstadoCaja`: `ABIERTA`, `CERRADA`), movimientos de la caja abierta (lista vacía si no hay ninguna) y turnos históricos.
5. **Cierre y Cuadre de Caja (`POST /finanzas/caja/cierre`):**
   * Efectivo esperado vs Efectivo contado (Diferencia de caja).
   * Total ventas digitales (Yape/Plin/Web) reportadas por `payments-service`.
   * Total egresos o pagos menores de caja chica.

### 4.2 Endpoint de Conciliación Centralizada (`GET /finanzas/balance/diario`)
```json
{
  "fecha": "2026-10-04",
  "ingresos": {
    "pasarelaDigital": 1845.50,
    "efectivoSalon": 1220.00,
    "posFisicoSalon": 980.00,
    "totalIngresos": 4045.50
  },
  "egresos": {
    "reembolsosEmitidos": 45.00,
    "gastosCajaChica": 80.00,
    "totalEgresos": 125.00
  },
  "balanceNeto": 3920.50,
  "ordenesAtendidas": 68,
  "ticketPromedio": 59.49
}
```

---

## 5. Seguridad Avanzada & Hardening (`auth-service`)

> ℹ️ **Nota de Auditoría:** Las funcionalidades base de **2FA con Spring Mail** y **Bloqueo por IP** ya quedaron construidas y probadas en la **Fase 1** (endpoint `POST /auth/verify-2fa` y el servicio `IpBlacklistService`).

### En la Fase 6 se completa la gobernanza administrativa:
1. **Consola de Seguridad para el Administrador:**
   * `GET /auth/admin/ips-bloqueadas`: Lista IPs en cuarentena, intentos fallidos y timestamp de expiración. Requiere autoridad `ADMIN`.
   * `DELETE /auth/admin/ips-bloqueadas/{ip}`: Desbloqueo manual inmediato en caso de falso positivo de un mozo o administrador. Requiere autoridad `ADMIN`.
2. **Políticas de Auditoría:**
   * El estado se persiste en la tabla de la entidad `IpBlacklist` (repositorio `IpBlacklistRepository`), con umbrales configurables por variables de entorno `MAX_FAILED_ATTEMPTS` (def. 5) y `BLOCK_DURATION_MINUTES` (def. 15).
   * La revocación de sesión existe vía refresh tokens (`POST /auth/logout`, `POST /auth/refresh`), pero **no** hay todavía un historial de inicios de sesión con User-Agent ni geolocalización IP.

---

## 6. Microservicio de Incidentes y Resiliencia (`incident-service`)

### 6.1 Bitácora de Incidentes (RF34)
Permite al equipo técnico y operativo registrar caídas de servicios, fallas en impresoras térmicas, errores en pasarela o problemas con proveedores.

```java
@Entity
@Table(name = "incidentes")
public class Incidente {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String titulo; // Ej: "Caída de conexión con WhatsApp Web"
    @Enumerated(EnumType.STRING)
    private Severidad severidad; // BAJA, MEDIA, ALTA, CRITICA
    @Enumerated(EnumType.STRING)
    private TipoIncidente tipo; // TECNICO, OPERATIVO, LOGISTICO
    @Column(length = 4000)
    private String descripcion;
    @Column(length = 4000)
    private String causaRaiz;
    @Column(length = 4000)
    private String solucionAplicada;
    @Enumerated(EnumType.STRING)
    private EstadoIncidente estado = EstadoIncidente.ABIERTO; // ABIERTO, EN_INVESTIGACION, RESUELTO
    private LocalDateTime ocurridoEn = LocalDateTime.now();
    private LocalDateTime resueltoEn;
    private String responsable;
}
```

Endpoint de cierre: `PATCH /incidentes/{id}/resolver` (no `PUT`).

### 6.2 Logs Centralizados y Observabilidad (RNF13)
* Todos los microservicios usan **SLF4J + Logback** con el patrón configurado en cada `application.properties`:
```properties
logging.pattern.console=%d{yyyy-MM-dd HH:mm:ss} [%thread] %-5level %logger{36} - %msg%n
logging.level.com.sistema.polleria=INFO
logging.level.org.springframework.security=WARN
```
* **No hay encoder JSON ni integración con Stackdriver/Cloud Logging en el código**: no existe `logstash-logback-encoder` en ningún `pom.xml`. La salida es texto plano a consola, recolectada por el runtime (`docker logs`, journald en las EC2 o Cloud Logging cuando corren en Cloud Run).
