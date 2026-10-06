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
| `inventory-service` | `8086` | `inventario_db` | Control de stock físico, despacho a cocina, registro de mermas y alertas predictivas. |
| `finance-service` | `8087` | `finanzas_db` | Arqueo de caja diaria en salón, conciliación pasarelas vs efectivo y reportes de utilidad. |
| `auth-service` | `8081` | `auth_db` | Blindaje de seguridad: panel de gestión de IPs bloqueadas y políticas estrictas de 2FA. |
| `incident-service` | `8088` | `incidentes_db` | Bitácora de incidentes operativos/técnicos, análisis causa raíz y trazabilidad centralizada. |

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
| **RNF05** | RNF | Bloqueo automático de IPs sospechosas sin intervención manual. | `auth-service` (`IpBlockingService`) |
| **RNF12** | RNF | Portabilidad multi-entorno (dev, stage, prod) mediante variables de entorno estrictas. | Todos (`.env`, Cloud Run) |
| **RNF13** | RNF | Trazabilidad con logs estructurados para auditoría de transacciones y errores. | Todos (Logback / Cloud Logging) |

---

## 3. Microservicio de Inventario y Almacén (`inventory-service`)

### 3.1 Receta y Bill of Materials (BOM)
Cada plato vendido en `orders-service` deduce teóricamente insumos según su receta:
* **1 Pollo a la Brasa:** 1 unidad de Pollo eviscerado (aprox. 1.8 kg), 0.8 kg de Papa pelada/cortada, 50 ml de Aderezo especial, 1 bolsa térmica.

### 3.2 Entidades Clave

```java
@Entity
@Table(name = "insumos")
public class Insumo {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre; // Ej: "Pollo Entero", "Papas Canchan", "Aceite Vegetal"
    private String unidadMedida; // KG, UNIDAD, LITRO
    private BigDecimal stockActual;
    private BigDecimal stockMinimoAlerta;
    private BigDecimal costoUnitario;
}

@Entity
@Table(name = "despachos_cocina")
public class DespachoCocina {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long solicitanteId; // Chef ID
    private LocalDateTime fechaDespacho = LocalDateTime.now();
    @OneToMany(cascade = CascadeType.ALL)
    private List<DespachoItem> items;
}

@Entity
@Table(name = "mermas")
public class Merma {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long insumoId;
    private BigDecimal cantidad;
    @Enumerated(EnumType.STRING)
    private MotivoMerma motivo; // VENCIMIENTO, MAL_ESTADO, ERROR_COCINA, CAIDA
    private String justificacion;
    private Long registradoPor;
    private LocalDateTime fecha = LocalDateTime.now();
}
```

### 3.3 Motor de Rentabilidad y Alertas Predictivas (RF25)
* **Algoritmo de Discrepancia:**
  $$\text{Consumo Real} = \text{Stock Inicial} + \text{Despachos} - \text{Stock Final} - \text{Mermas}$$
  $$\text{Discrepancia} = \text{Consumo Real} - \text{Consumo Teórico de Ventas}$$
* **Alerta Predictiva:** Si el ritmo de consumo de las últimas 3 horas proyecta agotar el stock antes del cierre, emite alerta: `"⚠️ Stock crítico de Papas: quedan 15 kg, estimado de quiebre en 45 min"`.

---

## 4. Microservicio de Finanzas y Caja (`finance-service`)

### 4.1 Ciclo de Arqueo de Caja (Turnos de Salón)
1. **Apertura de Caja (`POST /finanzas/caja/apertura`):** Monto inicial en efectivo (fondo para vuelto, ej. S/ 200.00).
2. **Registro de Cobros de Salón:** Pagos recibidos en efectivo o POS físico (Izipay/Niubiz).
3. **Cierre y Cuadre de Caja (`POST /finanzas/caja/cierre`):**
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

> ℹ️ **Nota de Auditoría:** Las funcionalidades base de **2FA con Spring Mail** y **Bloqueo por IP** ya quedaron construidas y probadas en la **Fase 1** (endpoints `/auth/login/verify-2fa` y el filtro `IpBlockingService`). 

### En la Fase 6 se completa la gobernanza administrativa:
1. **Consola de Seguridad para el Administrador:**
   * `GET /auth/admin/ips-bloqueadas`: Lista IPs en cuarentena, intentos fallidos y timestamp de expiración.
   * `DELETE /auth/admin/ips-bloqueadas/{ip}`: Desbloqueo manual inmediato en caso de falso positivo de un mozo o administrador.
2. **Políticas de Auditoría:**
   * Historial inmutable de inicios de sesión exitosos y fallidos con User-Agent y geolocalización IP aproximada.

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
    private LocalDateTime ocurridoEn;
    private LocalDateTime resueltoEn;
    private String responsable;
}
```

### 6.2 Logs Centralizados y Observabilidad (RNF13)
* Todos los microservicios generan logs estructurados en JSON utilizando **Logstash Logback Encoder**:
```json
{
  "timestamp": "2026-10-04T23:55:01.120Z",
  "level": "ERROR",
  "service": "orders-service",
  "traceId": "c4b92a10",
  "message": "Error al comunicar con payments-service: Connection Timeout",
  "stackTrace": "..."
}
```
* Integración out-of-the-box con Google Cloud Logging (GCP Cloud Run) y visualización en dashboards de métricas operativas.
