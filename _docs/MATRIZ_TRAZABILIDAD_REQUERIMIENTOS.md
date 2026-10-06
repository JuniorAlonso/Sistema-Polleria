# 🧭 Matriz Maestra de Trazabilidad de Requerimientos

**Proyecto:** Sistema de Pedidos y Delivery para Pollería — San Pollo de Ica  
**Curso:** Desarrollo Web Integrado (Ciclo 7 — UTP)  
**Fuente de Verdad Oficial:** [REQUERIMIENTOS_DEL_SISTEMA.docx](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%207/WebIntegrador/Sistema-Polleria/_docs/Bases/REQUERIMIENTOS_DEL_SISTEMA.docx)  
**Código Fuente:** [polleria/](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%207/WebIntegrador/Sistema-Polleria/polleria/)

---

## 1. Requerimientos Funcionales (RF01 – RF34)

| RF | Módulo Oficial | Descripción Oficial (DOCX) | Microservicio / Componente | Endpoints / Artefactos en Código | Fase | Estado |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **RF01** | Autenticación | Registro de clientes (nombre, correo, celular y contraseña). | `auth-service` (:8081) | `POST /auth/register`<br>Entidad `User`, DTO `RegisterRequest` | Fase 1 | ✅ Implementado |
| **RF02** | Autenticación | Inicio de sesión mediante correo o celular y contraseña. | `auth-service` (:8081) | `POST /auth/login`<br>DTO `LoginRequest`, `AuthResponse` | Fase 1 | ✅ Implementado |
| **RF03** | Autenticación | Cierre de sesión activa e invalidación de token. | `auth-service` (:8081) | `POST /auth/logout`<br>Revocación de Refresh Token en BD | Fase 1 | ✅ Implementado |
| **RF04** | Autenticación | Verificación en dos pasos (2FA) para personal y administradores (código al correo). | `auth-service` (:8081) | `POST /auth/verify-2fa`<br>`EmailService`, Spring Mail (Gmail SMTP) | Fase 1 | ✅ Implementado |
| **RF05** | Autenticación | Bloqueo temporal de acceso tras múltiples intentos fallidos (protección IP). | `auth-service` (:8081) | `IpBlockingService`<br>5 intentos fallidos = 15 min bloqueo | Fase 1 | ✅ Implementado |
| **RF06** | Carta y Productos | Administrador gestiona (crear, editar, eliminar y listar) productos de la carta. | `orders-service` (:8082) | `POST /productos`<br>`PUT /productos/{id}`<br>`DELETE /productos/{id}` | Fase 1 | ✅ Implementado |
| **RF07** | Carta y Productos | Clientes visualizan la carta de productos con precios e imágenes. | `orders-service` (:8082) | `GET /productos`<br>`GET /productos/{id}` (Público) | Fase 1 | ✅ Implementado |
| **RF08** | Carta y Productos | Administrador marca productos como "agotados", ocultándolos de la carta disponible. | `orders-service` (:8082) | `PATCH /productos/{id}/disponibilidad`<br>Filtro `soloDisponibles=true` | Fase 1 | ✅ Implementado |
| **RF09** | Carta y Productos | Crear y gestionar promociones y combos de productos. | `orders-service` (:8082) | `Categoria.COMBO`, `Categoria.PROMOCION`<br>`GET /productos?categoria=COMBO` | Fase 1 | ✅ Implementado |
| **RF10** | Carta y Productos | Acceso a la carta digital mediante escaneo de código QR en mesa. | `orders-service` (:8082) + `frontEnd` | `GET /productos` (público sin auth)<br>Entidad `Mesa.qrUrl` | Fase 1 | ✅ Implementado |
| **RF11** | Gestión de Mesas | Mozo visualiza estado de mesas, registra su ocupación y las vincula a una orden. | `orders-service` (:8082) | `GET /mesas`, `GET /mesas/libres`<br>`PATCH /mesas/{id}/estado`<br>Entidad `Mesa`, `MesaEstado` | Fase 2 | 🔄 Fase 2 (Base F1 lista) |
| **RF12** | Gestión de Mesas | Mozo registra pedidos de salón en dispositivo móvil tras selección presencial. | `frontEnd` (Comandera) + `orders-service` | `POST /ordenes` (`tipo: SALON`, `mesaId: X`) | Fase 2 | 🔄 Fase 2 (Base F1 lista) |
| **RF13** | Pedidos y Estados | Registrar pedidos para consumo en salón (mozo), delivery o recojo (cliente). | `orders-service` (:8082) | `POST /ordenes`<br>`OrdenTipo`: `SALON`, `DELIVERY`, `RECOJO` | Fase 1 | ✅ Implementado |
| **RF14** | Pedidos y Estados | Requerir registro de dirección y referencia de ubicación para pedidos de delivery. | `orders-service` (:8082) | DTO `CrearOrdenRequest`<br>Validación `direccionEntrega` y `referencia` | Fase 1 | ✅ Implementado |
| **RF15** | Pedidos y Estados | Ciclo de vida de pedidos mediante máquina de estados robusta. | `orders-service` (:8082) | `OrdenEstado`: `RECIBIDO → EN_PREPARACION → LISTO → EN_CAMINO → ENTREGADO / CANCELADO` | Fase 1 | ✅ Implementado |
| **RF16** | Pedidos y Estados | Personal de cocina y administración actualiza estado de pedidos validando transiciones. | `orders-service` (:8082) | `PATCH /ordenes/{id}/estado`<br>`OrdenStateMachineValidator` | Fase 1 | ✅ Implementado |
| **RF17** | Pedidos y Estados | Clientes consultan el estado actual de su pedido (tracking). | `orders-service` (:8082) + `frontEnd` | `GET /ordenes/{id}`<br>Vista `/tracking` en Angular | Fase 1 | ✅ Implementado |
| **RF18** | Pedidos y Estados | Asignación de repartidor a los pedidos de delivery. | `orders-service` (:8082) | `PATCH /ordenes/{id}/estado`<br>Campo `repartidorId` (Manual F1) | Fase 1 | ✅ Implementado (Manual) |
| **RF19** | Pagos y Finanzas | Métodos de pago: contraentrega, tarjeta o monederos digitales (Yape/Plin). | `payments-service` (:8083) | `MetodoPago`: `TARJETA`, `YAPE_PLIN`, `CONTRAENTREGA`<br>`POST /pagos` | Fase 1 + **Fase 5** | ✅ F1 (Mock) · 💳 F5 (Real MP) |
| **RF20** | Pagos y Finanzas | Registro de transacciones con estado (aprobada, rechazada, pendiente, cancelada). | `payments-service` (:8083) | `EstadoPago`: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `CANCELADO`<br>`GET /pagos/{id}` | Fase 1 + **Fase 5** | ✅ F1 · 💳 F5 (Webhook IPN) |
| **RF21** | Pagos y Finanzas | Actualización automática del estado del pedido según resultado de pasarela. | `payments-service` → `orders-service` | Feign/RestClient inter-servicio<br>`MercadoPagoWebhookController` | Fase 1 + **Fase 5** | ✅ F1 · 💳 F5 (IPN Auto) |
| **RF22** | Pagos y Finanzas | Registro centralizado de ingresos validados por pasarela o cobrados en caja. | `finance-service` (:8087) / `payments-service` | `GET /pagos` (Admin en F1)<br>Módulo Arqueo de Caja y Conciliación | **Fase 6** | 🏢 Fase 6 (Base F1 lista) |
| **RF23** | Inventario | Chef solicita y registra despacho de lotes de insumos hacia cocina. | `inventory-service` (:8086) | `POST /inventario/despachos`<br>Entidades `Insumo`, `DespachoCocina` | **Fase 6** | 🏢 Fase 6 |
| **RF24** | Inventario | Personal registra merma de insumos perecibles no vendidos al finalizar jornada. | `inventory-service` (:8086) | `POST /inventario/mermas`<br>Entidad `Merma`, enum `MotivoMerma` | **Fase 6** | 🏢 Fase 6 |
| **RF25** | Inventario | Métricas de rentabilidad y alertas predictivas de abastecimiento (ventas vs mermas). | `inventory-service` (:8086) | `GET /inventario/metricas/rentabilidad`<br>`GET /inventario/alertas` | **Fase 6** | 🏢 Fase 6 |
| **RF26** | Feedback y Reseñas | Clientes califican (1 a 5 estrellas) y dejan reseñas de pedidos completados. | `feedback-service` (:8085) | `POST /feedback/resenas`<br>Entidad `Resena`, validación orden entregada | **Fase 4** | ⭐ Fase 4 |
| **RF27** | Feedback y Reseñas | Clientes reportan problemas adjuntando descripción y evidencia fotográfica. | `feedback-service` (:8085) + Storage S3 | `POST /feedback/reclamos`<br>Subida multipart/form-data | **Fase 4** | ⭐ Fase 4 |
| **RF28** | Feedback y Reseñas | Administrador visualiza, responde y gestiona estado de reseñas/reportes (Abierto, En Revisión, Resuelto). | `feedback-service` (:8085) + `frontEnd` | `GET /feedback/reclamos`<br>`PATCH /feedback/reclamos/{id}/estado` | **Fase 4** | ⭐ Fase 4 |
| **RF29** | Feedback y Reseñas | Administrador emite reembolsos asociados a reportes procedentes. | `feedback-service` → `payments-service` | `POST /pagos/{id}/reembolso` | **Fase 4** | ⭐ Fase 4 |
| **RF30** | Notificaciones | Notificación WhatsApp al cliente al confirmar el pago de delivery. | `notification-service` (:3001) | `POST /api/notificaciones/whatsapp/pago`<br>whatsapp-web.js client | **Fase 3** | 📲 Fase 3 (Base F1 lista) |
| **RF31** | Notificaciones | Notificaciones WhatsApp automáticas en cada cambio de estado de delivery. | `orders-service` → `notification-service` | `POST /api/notificaciones/whatsapp/estado` | **Fase 3** | 📲 Fase 3 (Base F1 lista) |
| **RF32** | Notificaciones | Registro y auditoría del estado de envíos de notificaciones (enviado, en cola, fallido). | `notification-service` (:3001) | `NotificationLog`<br>`GET /api/notificaciones/historial` | **Fase 3** | 📲 Fase 3 |
| **RF33** | Notificaciones | Notificación en tiempo real al dispositivo del mozo indicando plato listo en cocina. | `orders-service` (:8082) + WS STOMP | WebSocket Broker `/topic/mozo/mesas`<br>Trigger al pasar orden a `LISTO` | Fase 2 | 🔄 Fase 2 |
| **RF34** | Incidentes | Registro y documentación de incidentes técnicos u operativos (causa raíz y solución). | `incident-service` (:8088) | `POST /incidentes`<br>Entidad `IncidenteOperativo` | **Fase 6** | 🏢 Fase 6 |

---

## 2. Requerimientos No Funcionales (RNF01 – RNF14)

| RNF | Categoría | Descripción Oficial (DOCX) | Implementación Técnica en Arquitectura | Estado |
| :---: | :--- | :--- | :--- | :---: |
| **RNF01** | Disponibilidad | Disponibilidad 24/7 para los clientes. | Contenedores en Google Cloud Run con réplicas automáticas y base de datos gestionada en AWS RDS PostgreSQL / Cloud SQL con alta disponibilidad. | 🟢 Verificado |
| **RNF02** | Seguridad | Contraseñas encriptadas usando BCrypt. | `BCryptPasswordEncoder(strength = 10)` en `auth-service` para todo usuario. | ✅ Implementado |
| **RNF03** | Seguridad | Comunicación HTTPS y validación JWT en cada petición. | TLS/SSL terminación en Cloud Run / Ingress; `JwtAuthFilter` en cada microservicio validando firma HS256 y expiración. | ✅ Implementado |
| **RNF04** | Seguridad | Políticas CORS para restringir consumo a frontends autorizados. | Filtros CORS específicos por servicio (`cors.allowed-origins` en `application.properties`). | ✅ Implementado |
| **RNF05** | Seguridad | Bloqueo automático de IPs sospechosas sin intervención manual. | `IpBlockingService` en `auth-service` (5 intentos fallidos = 15 min bloqueo en memoria/Caffeine). | ✅ Implementado |
| **RNF06** | Rendimiento | WebSockets de baja latencia (< 500 ms) hacia tablets de mozos. | Spring WebSocket con STOMP broker en memoria sobre SockJS en `orders-service`. | 🔄 Fase 2 |
| **RNF07** | Rendimiento | Actualización de pedidos casi en tiempo real. | Polling reactivo cada 3-5s en Frontend (Fase 1) y eventos WebSockets / Push en Fase 2. | ✅ Implementado |
| **RNF08** | Escalabilidad | Microservicios desplegados independientemente con escalabilidad individual. | Contenedores Docker independientes por servicio (`auth-service`, `orders-service`, `payments-service`, `notification-service`). | ✅ Implementado |
| **RNF09** | Fiabilidad | Registro y notificación automática de cancelaciones de pago por pasarela. | `MercadoPagoWebhookController` gestiona eventos `payment.cancelled` o `payment.rejected` actualizando el estado inmediatamente. | ✅ F1 (Mock) · 💳 F5 (Real) |
| **RNF10** | Fiabilidad | Respeto a límites de WhatsApp.js: cola y espera de 10s entre envíos anti-baneo. | Queue Worker FIFO con delay programado de 10.000 ms en `notification-service`. | 📲 Fase 3 |
| **RNF11** | Mantenibilidad | Código documentado, comentado y commits bajo Git/GitHub. | Convención Conventional Commits, arquitectura hexagonal/limpia en paquetes, documentación viva en `_docs/`. | ✅ Implementado |
| **RNF12** | Mantenibilidad | Portabilidad multi-ambiente (dev, test, prod) mediante variables de entorno. | `application.properties` desacoplado con `${DB_URL}`, `${JWT_SECRET}`, etc.; archivo `.env.example`. | ✅ Implementado |
| **RNF13** | Trazabilidad | Logs guardados de transacciones y errores para investigar incidentes. | SLF4J + Logback estructurado con correlación por `orderId` y `pagoId`. | ✅ Implementado |
| **RNF14** | Usabilidad | UI responsiva y fácil de usar desde smartphones y tablets. | Angular 19 con diseño adaptable para clientes móviles, tablets de mozo y terminales KDS de cocina. | ✅ Implementado |

---

## 3. Registro Centralizado de Puertos y Servicios

| Puerto | Microservicio | Entorno / Stack | Base de Datos / Storage | Fase |
| :---: | :--- | :--- | :--- | :---: |
| **8081** | `auth-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_auth` / RDS) | Fase 1 & 6 |
| **8082** | `orders-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_orders` / RDS) | Fase 1 & 2 |
| **8083** | `payments-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_payments` / RDS) | Fase 1 & 5 |
| **3001** | `notification-service` | Node.js 18+ / Express / WWebJS | SQLite / Local Storage de sesión | Fase 1 & 3 |
| **8084** | *Reservado para API Gateway / Proxy* | Spring Cloud Gateway (Opcional) | — | Opcional |
| **8085** | `feedback-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL + AWS S3 / Cloud Storage | **Fase 4** |
| **8086** | `inventory-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_inventario`) | **Fase 6** |
| **8087** | `finance-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_finanzas`) | **Fase 6** |
| **8088** | `incident-service` | Spring Boot 3.3.4 (Java 21) | PostgreSQL (`polleria_incidentes`) | **Fase 6** |
| **4200** | `frontend` | Angular 19 / TypeScript | LocalStorage / SessionStorage | Fase 1 – 6 |

---

## 4. Mapa de Fases

| Fase | Nombre | Prioridad | RFs Cubiertos | Doc Detallada |
| :---: | :--- | :---: | :--- | :--- |
| **1** | 🚨 Flujo Crítico del Pedido (MVP) | Alta | RF01–RF10, RF13–RF21 | [fase_1_core_pedidos/](./fases/fase_1_core_pedidos/README.md) |
| **2** | 🔄 Operatividad en Salón y Tiempo Real | Media | RF11, RF12, RF16, RF33 | [fase_2_salon_mesas/](./fases/fase_2_salon_mesas/README.md) |
| **3** | 📲 Notificaciones WhatsApp | Media | RF30, RF31, RF32 | [fase_3_notificaciones_wasap/](./fases/fase_3_notificaciones_wasap/README.md) |
| **4** | ⭐ Feedback, Reseñas y Reclamos | Media-Baja | RF26, RF27, RF28, RF29 | [fase_4_feedback_resenas/](./fases/fase_4_feedback_resenas/README.md) |
| **5** | 💳 Pasarela de Pagos Mercado Pago | Media | RF19*, RF20*, RF21* | [fase_5_pagos_mercadopago/](./fases/fase_5_pagos_mercadopago/README.md) |
| **6** | 🏢 Backoffice, Inventario, Finanzas y Seguridad | Baja | RF22–RF25, RF34 | [fase_6_backoffice_inventario/](./fases/fase_6_backoffice_inventario/README.md) |

*\* RF19, RF20, RF21 tienen base funcional en Fase 1 (mocks + contraentrega). Fase 5 amplía con pasarela real.*
