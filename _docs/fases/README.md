# 📚 Índice Maestro de Fases de Desarrollo — Sistema Pollería

> **Proyecto Web Integrador — UTP Ciclo 7**  
> **Arquitectura:** Microservicios con Spring Boot 3.4.5 + PostgreSQL 16 + Frontend Angular 19 (Signals & SSR)

Este directorio consolida la documentación técnica y funcional de cada una de las fases de implementación del sistema integral para la pollería **San Pollo**:

---

## 🗺️ Mapa de Fases y Estado del Proyecto

| Fase | Título de la Fase | Microservicio(s) Principal(es) | Frontend Responsable | Estado | Documento |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | **Core de Pedidos, Carta y Tracking** | `orders-service` (:8082)<br>`auth-service` (:8081) | Home, Menú Carta, Carrito, Checkout, Tracking | ✅ Completada | [Fase 1](./fase_1_core_pedidos/README.md) |
| **2** | **Operatividad en Salón, Mesas y Tiempo Real** | `orders-service` (:8082) | Admin Dashboard (CRUD Mesas, Croquis), Mozo Salón, WebSocket | ✅ **100% Implementada** | [Fase 2](./fase_2_salon_mesas/README.md) |
| **3** | **Notificaciones Multicanal y WhatsApp** | `orders-service` (:8082)<br>`notification-service` | Panel Admin (Log de Notificaciones), Avisos WhatsApp | ✅ Completada | [Fase 3](./fase_3_notificaciones_whatsapp/README.md) |
| **4** | **Feedback, Reseñas y Reclamaciones** | `feedback-service` (:8085)<br>`payments-service` (:8083) | Tracking (Calificación 5 estrellas, Libro de Reclamaciones), Admin | ✅ Completada | [Fase 4](./fase_4_feedback_resenas/README.md) |
| **5** | **Pasarela de Pagos Digitales y Facturación** | `payments-service` (:8083) | Checkout (MercadoPago, Tarjetas, Yape/Plin), Facturación | 🔄 En Integración | [Fase 5](./fase_5_pagos_mercadopago/README.md) |
| **6** | **Backoffice, Inventario, Finanzas y Seguridad** | `inventory-service` (:8086)<br>`finance-service` (:8087)<br>`incident-service` (:8088) | Admin Dashboard (Despachos, Mermas, Arqueo de Caja, Bitácora) | ✅ Completada | [Fase 6](./fase_6_backoffice_inventario/README.md) |

---

## 📌 Hitos Principales Implementados en la Fase 2

La **Fase 2** ([Ver documentación detallada](./fase_2_salon_mesas/README.md)) resolvió los siguientes puntos clave del sistema:

1. **Separación de Responsabilidades:** 
   - **Administrador:** CRUD de mesas, dimensionamiento de cuadrículas, topología y auto-organización matricial.
   - **Mozo:** Asignación de comensales, comanda rápida, máquina de estados y recepción de alertas en vivo de cocina.
2. **Máquina de Estados de Mesa:**
   - Transiciones estrictas: `LIBRE` ➔ `OCUPADA` ➔ `POR_COBRAR` ➔ `EN_LIMPIEZA` ➔ `LIBRE` (con soporte para `RESERVADA`).
3. **Croquis Matricial por Zonas (Slides):**
   - Vistas independientes: *Salón Central (4×5)*, *Terraza (8×9)*, *Zona VIP (3×4)* y *Segundo Piso (4×6)*.
   - Personalización dinámica de filas y columnas persistida en base de datos PostgreSQL (`ZonaSalon`).
   - Modos Click-to-Move y Drag & Drop nativo HTML5.
   - Algoritmo de auto-organización en lote con `forkJoin` y rollback automático ante errores.
4. **UX Asíncrona y Spinners de Carga:**
   - Overlays de carga con spinner SVG circular (`animate-spin`) sobre el croquis.
   - Botones con estado de espera y bloqueo de formularios para prevenir duplicados.
5. **Comunicación en Tiempo Real y Resiliencia:**
   - WebSocket STOMP (`/ws-polleria`) y fallback reactivo de alta frecuencia para avisos instantáneos de platos listos desde cocina hacia el mozo.
   - Ciclo de vida estricto con `OnDestroy` y `clearInterval` para erradicar fugas de memoria en Angular y SSR.
6. **Concurrencia Optimista y Resiliencia en Pagos:**
   - Control de concurrencia optimista (`@Version` en JPA) con intercepción HTTP `409 CONFLICT` y recarga automática de mesas.
   - Failover en 3 Tiers con proxy angular y sandbox transparente (`isMock: true`) para contingencia de pagos.
