# **PLAN DE DESARROLLO DE MICROSERVICIOS**

**Proyecto:** Sistema de Pedidos y Delivery para Pollería — San Pollo de Ica  
**Arquitectura:** Microservicios (Spring Boot + Node.js + Angular 19)  
**Referencia Oficial:** [REQUERIMIENTOS_DEL_SISTEMA.docx](./REQUERIMIENTOS_DEL_SISTEMA.docx) y [Matriz de Trazabilidad](../MATRIZ_TRAZABILIDAD_REQUERIMIENTOS.md)

---

## **1. ESTRATEGIA DE DESARROLLO POR FASES**

El desarrollo se divide en **6 fases evolutivas**. La **Fase 1** constituye el MVP funcional obligatorio para el primer entregable académico. Las **Fases 3 y 5** (WhatsApp y Mercado Pago) están diseñadas como fases independientes asignables a compañeros de equipo para desarrollo y pruebas en paralelo.

### **🚨 FASE 1: Flujo Crítico del Pedido (PRIMER ENTREGABLE)**

**Objetivo:** Permitir que un cliente se registre/autentique, consulte la carta, arme un pedido, pague y observe la evolución del estado de su orden.  
**Prioridad:** Alta (Obligatoria para el Entregable 1).

| Microservicio | Rol | Alcance de Desarrollo Implementado | Estado y Observaciones |
| :---- | :---- | :---- | :---- |
| **1.1 Autenticación** (`auth-service` :8081) | Puerta de entrada y seguridad. | • Registro de clientes (RF01)<br>• Inicio de sesión por correo o celular (RF02)<br>• Cierre de sesión seguro con revocación de tokens (RF03)<br>• Cifrado BCrypt (RNF02) y Access Token con Refresh Token Rotation (RTR)<br>• Verificación 2FA vía correo con Spring Mail (RF04)<br>• Bloqueo temporal por intentos fallidos de IP (RF05) | ✅ **100% Implementado** (Incluye 2FA y Bloqueo IP completados en F1). |
| **1.2 Carta y Productos** (`orders-service` :8082) | Gestión de catálogo y carta pública. | • CRUD de productos para el administrador (RF06)<br>• Listado de productos con precios, fotos y categorías (RF07)<br>• Marcado de productos como "Agotado" / Disponible (RF08)<br>• Promociones y combos mediante categorías dedicadas (RF09)<br>• Carta digital accesible por QR directo en mesas (RF10) | ✅ **100% Implementado** |
| **1.3 Pedidos y Estados** (`orders-service` :8082) | Ciclo de vida y orquestación del pedido. | • Registro de pedidos para Salón, Delivery y Recojo (RF13)<br>• Captura y validación de dirección y referencia en delivery (RF14)<br>• **Máquina de Estados Robusta (RF15):**<br>&nbsp;&nbsp;`RECIBIDO → EN_PREPARACION → LISTO → EN_CAMINO → ENTREGADO / CANCELADO`<br>• Actualización de estados por personal y cocina (RF16)<br>• Consulta de estado y tracking del cliente (RF17)<br>• Asignación manual de repartidor en delivery (RF18) | ✅ **100% Implementado** |
| **1.4 Pagos** (`payments-service` :8083) | Validación y cobro de transacciones. | • Selección de métodos: Tarjeta, Yape/Plin, Contraentrega (RF19)<br>• Registro transaccional con estados auditados (RF20)<br>• Actualización automática del pedido vía REST (RF21)<br>• **Gateways Mock** para pruebas rápidas y modo Offline<br>• Cobro operativo `CONTRAENTREGA` (efectivo) | ✅ **100% Implementado** (Mocks + Contraentrega) |
| **1.5 Notificaciones** (`notification-service` :3001) | Mensajería de alertas. | • Servicio en Node.js + Express con `whatsapp-web.js`<br>• Endpoint `/notificar` llamado por `orders-service` al actualizar estado de la orden | ✅ **Base Operativa en F1** |

> 💡 **Nota:** La pasarela real de Mercado Pago se implementa en la [Fase 5](../fases/fase_5_pagos_mercadopago/README.md) como fase independiente.

---

### **🔄 FASE 2: Operatividad en Salón y Tiempo Real**

**Objetivo:** Optimizar la experiencia operativa del mozo y la cocina en el restaurante presencial mediante visualización interactiva y comunicación en tiempo real.  
**Prioridad:** Media.

* **2.1 Gestión de Mesas (`orders-service`):** Módulo de mesas `/mesas` con visualización de estado (Libre, Ocupada, Reservada), vinculación con órdenes activas de salón y soporte para migración de coordenadas gráficas (`posicionX`, `posicionY`) (RF11, RF12).  
* **2.2 Notificaciones WebSockets / STOMP (`orders-service`):** Implementación de broker STOMP sobre SockJS para enviar alertas push de baja latencia (< 500 ms) a la tablet del mozo en el momento que cocina marca la orden como `LISTO` (RF33, RNF06).

📄 **Documentación detallada:** [fase_2_salon_mesas/README.md](../fases/fase_2_salon_mesas/README.md)

---

### **📲 FASE 3: Notificaciones WhatsApp** *(Fase Independiente)*

**Objetivo:** Implementar el motor de mensajería automática vía WhatsApp para confirmar pagos y notificar cambios de estado en pedidos de delivery, con cola anti-baneo y trazabilidad de envíos.  
**Prioridad:** Media.  
**Asignación:** Fase independiente para desarrollo y pruebas por un compañero de equipo.

* **3.1 Motor WhatsApp (`notification-service`):** Cola FIFO anti-baneo (espera estricta de 10s entre mensajes, RNF10) para confirmación de pago (RF30) y tracking de delivery (RF31) con auditoría de envíos (RF32).

📄 **Documentación detallada:** [fase_3_notificaciones_wasap/README.md](../fases/fase_3_notificaciones_wasap/README.md)

---

### **⭐ FASE 4: Feedback, Reseñas y Gestión de Reclamos**

**Objetivo:** Habilitar el canal de satisfacción del cliente con calificaciones, reseñas, reportes con evidencia fotográfica y emisión de reembolsos.  
**Prioridad:** Media-Baja.

* **4.1 Feedback y Reseñas (`feedback-service` :8085):** Calificaciones de 1 a 5 estrellas (RF26), subida de evidencias fotográficas para reclamos (RF27), panel de gestión de incidencias (RF28) con reembolso asociado (RF29).

📄 **Documentación detallada:** [fase_4_feedback_resenas/README.md](../fases/fase_4_feedback_resenas/README.md)

---

### **💳 FASE 5: Pasarela de Pagos Mercado Pago** *(Fase Independiente)*

**Objetivo:** Integrar la pasarela oficial de Mercado Pago (Checkout Pro, SDK y Webhooks IPN) en el `payments-service` existente, reemplazando los gateways mock por cobros reales.  
**Prioridad:** Media.  
**Asignación:** Fase independiente para desarrollo y pruebas por un compañero de equipo.

* **5.1 Mercado Pago (`payments-service`):** Integración con Mercado Pago SDK Java (Checkout Pro y Webhooks IPN), ampliando RF19, RF20 y RF21 con cobro real. Soporte para reembolsos automáticos vía API de Mercado Pago (RF29). Pattern Strategy para convivencia con gateways mock existentes.

📄 **Documentación detallada:** [fase_5_pagos_mercadopago/README.md](../fases/fase_5_pagos_mercadopago/README.md)

---

### **🏢 FASE 6: Backoffice, Inventario, Finanzas y Seguridad Avanzada**

**Objetivo:** Completar la gestión de la cadena de suministro, control financiero integral y gobernanza enterprise del sistema.  
**Prioridad:** Baja.

* **6.1 Inventario y Almacén (`inventory-service` :8086):** Ficha técnica/BOM por plato, solicitud y despacho a cocina por el Chef, control de mermas diarias y alertas predictivas de stock mínimo (RF23, RF24, RF25).  
* **6.2 Finanzas (`finance-service` :8087):** Centralización de ingresos (pasarelas online vs cobro en caja de salón), balance neto y arqueo de caja diario (RF22).  
* **6.3 Seguridad Avanzada & Auditoría (`auth-service` :8081):** Panel administrativo para desbloqueo manual de IPs, auditoría de sesiones activas y trazabilidad de accesos (RF04, RF05, RNF05).  
* **6.4 Registro de Incidentes (`incident-service` :8088):** Bitácora estructurada de incidentes técnicos y operativos con causa raíz y plan de mitigación (RF34, RNF13).

📄 **Documentación detallada:** [fase_6_backoffice_inventario/README.md](../fases/fase_6_backoffice_inventario/README.md)

---

## **2. REGLAS ARQUITECTÓNICAS DEL SISTEMA**

1. **Alineación con la Matriz Oficial:** Ningún microservicio debe inventar códigos de requerimientos; todos se rigen bajo la norma de la [Matriz Maestra de Trazabilidad](../MATRIZ_TRAZABILIDAD_REQUERIMIENTOS.md).
2. **Autonomía de Datos:** Cada microservicio gestiona su propio schema o base de datos en PostgreSQL. La comunicación inter-servicio se realiza exclusivamente mediante APIs REST protegidas por JWT.
3. **Resiliencia y Monitoreo:** Todos los servicios exponen endpoints de health check (`/actuator/health` o `/status`) y centralizan credenciales mediante variables de entorno seguras (RNF12).
4. **Fases Independientes:** Las Fases 3 (WhatsApp) y 5 (Mercado Pago) están diseñadas para ser desarrolladas, probadas y desplegadas de forma independiente por compañeros de equipo, sin bloquear ni depender del progreso de otras fases.