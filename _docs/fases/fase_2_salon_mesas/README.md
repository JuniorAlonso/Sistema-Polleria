# 🔄 FASE 2 — Operatividad en Salón y Tiempo Real

**Objetivo:** Mejorar la experiencia operativa del mozo y la cocina mediante la sincronización en tiempo real y la administración gráfica de mesas en salón.

**Prioridad:** Media — Optimización de flujos internos y reducción de tiempos de atención en salón.

---

## 1. Visión Arquitectónica y Análisis de Dominio

```
 ┌──────────────────────┐               ┌──────────────────────────────────────────────┐
 │   Tablet Mozo (UI)   │               │            orders-service (:8082)            │
 │   - Mapa de Mesas    │◄─── REST ────►│  ┌────────────────────┐ ┌─────────────────┐  │
 │   - Comandera Salón  │               │  │ Módulo Mesas       │ │ Módulo Órdenes  │  │
 │   - Receptor STOMP   │◄─── WS/STOMP ─┼──┤ (Mesa / Estado)    │ │ (Ciclo de Vida) │  │
 └──────────────────────┘    Push Alert │  └─────────┬──────────┘ └────────┬────────┘  │
                                        │            │                     │           │
 ┌──────────────────────┐               │            └──────────┬──────────┘           │
 │   Pantalla Cocina    │               │                       ▼                      │
 │   KDS (Chef UI)      ├──── REST ────►│            PostgreSQL (AWS RDS)              │
 └──────────────────────┘ PATCH Estado  └──────────────────────────────────────────────┘
```

### 💡 Decisión Arquitectónica Clave: ¿`ms-mesas` o Bounded Context en `orders-service`?
* **El dilema:** La propuesta preliminar sugería un `ms-mesas` independiente.
* **El veredicto técnico:** La entidad `Mesa` y la entidad `Orden` (tipo `SALON`) comparten un ciclo de vida atómico. Separar `Mesa` en un microservicio autónomo con base de datos propia para una sola tabla genera **monolito distribuido**, latencia innecesaria y riesgo de inconsistencias transaccionales (bloquear mesa sin orden creada o viceversa).
* **Solución de ingeniería:** Implementar el módulo de Mesas como un **subdominio/paquete desacoplado dentro de `orders-service`** (donde ya residen los cimientos de `Mesa` y `MesaRepository`), exponiendo APIs REST independientes (`/mesas/*`). En caso de que la cátedra exija estrictamente un servicio físico separado, se extrae mediante un cliente Feign/REST hacia `orders-service`.

---

## 2. Requerimientos Cubiertos (Oficial UTP)

Alineada con la especificación de [REQUERIMIENTOS_DEL_SISTEMA.docx](../../Bases/REQUERIMIENTOS_DEL_SISTEMA.docx):

| Código | Tipo | Descripción Oficial | Componente Responsable |
| :--- | :---: | :--- | :--- |
| **RF11** | RF | El mozo visualiza el estado de las mesas, registra su ocupación y las vincula a una orden. | `orders-service` (`MesaController`) |
| **RF12** | RF | El mozo registra pedidos de salón en dispositivo móvil tras selección presencial del cliente. | `frontEnd` (Comandera Mozo) + `orders-service` |
| **RF16** | RF | Personal de cocina y admin actualiza estado de pedidos (`LISTO` cocina), validando transiciones. | `orders-service` (`OrdenService`) |
| **RF33** | RF | Notificaciones en tiempo real al dispositivo del mozo indicando qué plato de qué mesa está listo. | `orders-service` (WebSocket STOMP Broker) |
| **RNF06** | RNF | Notificaciones WebSockets con baja latencia (< 500 ms) hacia tablets de mozos. | Spring WebSocket / STOMP over SockJS |
| **RNF14** | RNF | UI responsiva y adaptada a dispositivos móviles y tablets de salón. | Angular 19 (Componentes táctiles reactivos) |

---

## 3. Modelo de Datos y Entidades

### 3.1 Entidad Base Existente en Fase 1 (`Mesa.java` en `orders-service`)
En la Fase 1 ya se encuentra implementada la estructura central de mesas:
```java
@Entity
@Table(name = "mesas")
public class Mesa {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Integer numero;

    @Column(nullable = false)
    private Integer capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MesaEstado estado = MesaEstado.LIBRE;

    @Column(length = 500)
    private String qrUrl; // URL directa al menú para escaneo en mesa
}
```

### 3.2 Enumeración Actual en Código (`MesaEstado.java`)
```java
public enum MesaEstado {
    LIBRE,        // Disponible para asignar comensales
    OCUPADA,      // Clientes sentados con orden activa en proceso
    RESERVADA     // Reservada con antelación
}
```

### 3.3 Migración de Base de Datos para Fase 2 (Extensión Gráfica y Operativa)
Para habilitar el plano interactivo de salón (drag-and-drop y visualización espacial) y el ciclo de rotación completo, se añade el script de migración DDL:

```sql
-- Migración V2__mesas_layout_y_estados.sql
ALTER TABLE mesas ADD COLUMN posicion_x INTEGER DEFAULT 0;
ALTER TABLE mesas ADD COLUMN posicion_y INTEGER DEFAULT 0;

-- (Opcional) Extensión del Enum en PostgreSQL si se gestiona a nivel DB:
-- ALTER TYPE mesa_estado ADD VALUE 'POR_COBRAR';
-- ALTER TYPE mesa_estado ADD VALUE 'EN_LIMPIEZA';
```

Estados ampliados para la experiencia de salón:
* `LIBRE`: Verde — Disponible para ocupación inmediata.
* `OCUPADA`: Rojo — Orden en preparación o comensales consumiendo.
* `POR_COBRAR`: Amarillo — Comensales pidieron la cuenta; caja emitiendo pre-cuenta.
* `EN_LIMPIEZA`: Azul — Desocupada, personal de salón desinfectando mesa.
* `RESERVADA`: Púrpura — Asignada para reserva futura.

---

## 4. Especificación de Endpoints REST

### 4.1 Gestión de Mesas (`/mesas`)

#### `GET /mesas`
* **Acceso:** 🔒 `ADMIN`, `MOZO`
* **Descripción:** Retorna el listado de mesas con su estado actual y coordenadas de plano.
* **Respuesta Fase 1 (Base Actual):**
```json
[
  {
    "id": 1,
    "numero": 1,
    "capacidad": 4,
    "estado": "LIBRE",
    "qrUrl": "https://sanpollo.pe/menu?mesa=1"
  }
]
```
* **Respuesta Fase 2 (Enriquecida con Orden Activa y Layout):**
```json
[
  {
    "id": 1,
    "numero": 1,
    "capacidad": 4,
    "estado": "OCUPADA",
    "posicionX": 100,
    "posicionY": 150,
    "qrUrl": "https://sanpollo.pe/menu?mesa=1",
    "ordenActiva": {
      "ordenId": 45,
      "mozoId": 3,
      "total": 68.50,
      "estadoOrden": "EN_PREPARACION",
      "tiempoEsperaMinutos": 12
    }
  }
]
```

#### `POST /mesas` (Admin)
* **Body:**
```json
{
  "numero": 5,
  "capacidad": 6
}
```

#### `PATCH /mesas/{id}/estado`
* **Acceso:** 🔒 `ADMIN`, `MOZO`
* **Body:**
```json
{
  "estado": "OCUPADA" // LIBRE, OCUPADA, RESERVADA (o POR_COBRAR, EN_LIMPIEZA tras migración)
}
```

---

## 5. Arquitectura de Notificaciones en Tiempo Real (WebSockets / STOMP)

### 5.1 Configuración del Broker en Spring Boot
En `orders-service` (o `notification-service` integrado):
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefijo para suscripciones de clientes
        config.enableSimpleBroker("/topic", "/queue");
        // Prefijo para enviar mensajes desde clientes
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-polleria")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
```

### 5.2 Tópicos y Canales de Publicación

| Canal / Destino | Emisor | Receptores | Payload / Evento |
| :--- | :--- | :--- | :--- |
| `/topic/salon/pedidos-listos` | Cocina (`Chef`) | Todos los Mozos en salón | Alerta global de plato listo con mesa y detalle |
| `/queue/mozo/{mozoId}/alertas` | Sistema | Mozo específico responsable | Alerta dirigida al mozo que tomó la orden |
| `/topic/cocina/nuevas-comandas` | Mozo (`Tablet`) | Pantalla KDS Cocina | Nuevo pedido ingresado en salón para preparación |

### 5.3 Payload del Evento `PEDIDO_LISTO_COCINA`
```json
{
  "evento": "PEDIDO_LISTO_COCINA",
  "ordenId": 45,
  "mesaNumero": 3,
  "mozoId": 2,
  "mozoNombre": "Carlos Mendoza",
  "items": [
    { "nombre": "1/2 Pollo a la Brasa", "cantidad": 1, "notas": "Papas bien crocantes" },
    { "nombre": "Porción de Tequeños", "cantidad": 1, "notas": "" }
  ],
  "timestamp": "2026-10-04T23:15:30Z"
}
```

---

## 6. Flujo Operativo Integral (Secuencia Mozo - Cocina)

```
Mozo (Tablet)           orders-service          Cocina KDS             Broker STOMP
     │                        │                      │                      │
     ├── 1. Selecciona Mesa ─►│                      │                      │
     ├── 2. POST /ordenes ───►│ (Estado: RECIBIDO)   │                      │
     │   (Mesa -> OCUPADA)    ├── 3. Evento STOMP ─────────────────────────►│
     │                        │   (/topic/nuevas-comandas)                  ├──► Recibe comanda
     │                        │                      │                      │
     │                        │                      ├── 4. Inicia cocción  │
     │                        │                      │   (PATCH PREPARANDO) │
     │                        │                      │                      │
     │                        │◄── 5. PATCH /ordenes/{id}/estado (LISTO) ───┤
     │                        │                      │                      │
     │                        ├── 6. Dispara evento STOMP ─────────────────►│
     │◄── 7. Notificación Push ─────────────────────────────────────────────┤
     │    (Audio + Alerta: "Mesa 3 LISTA")                                  │
     │                                                                      │
     ├── 8. Mozo sirve plato y confirma entrega (PATCH ENTREGADO)           │
```

---

## 7. Entregables para el Frontend (Angular 19)

1. **`MapaMesasComponent` (`/admin/mesas` & `/mozo/mesas`):**
   * Cuadrícula interactiva tipo plano con drag-and-drop o botones directos.
   * Colores dinámicos: Verde (Libre), Rojo (Ocupada), Naranja (Listo para servir), Gris (En limpieza).
   * Clic en mesa libre: Abre modal para iniciar pedido de salón.
   * Clic en mesa ocupada: Muestra cuenta actual y estado de los platos.

2. **`ComanderaMozoComponent` (`/mozo/comanda`):**
   * Selector rápido de categorías (Pollos, Guarniciones, Bebidas).
   * Modificadores de pedido por plato ("Sin ensalada", "Papas bien cocidas").
   * Botón de envío directo a cocina.

3. **`AlertNotificationService` (WebSocket Client):**
   * Integración con `@stomp/stompjs` y `sockjs-client`.
   * Reproducción de sonido de campana/timbre al recibir evento de cocina.
   * Notificación flotante (toast) con acción rápida "Ver orden".
