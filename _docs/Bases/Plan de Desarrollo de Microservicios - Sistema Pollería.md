# **PLAN DE DESARROLLO DE MICROSERVICIOS**

**Proyecto:** Sistema de Pedidos y Delivery para Pollería  
**Arquitectura:** Microservicios (Spring Boot \+ Angular)

## **1\. ESTRATEGIA DE DESARROLLO POR FASES**

El desarrollo se divide en 4 fases. La **Fase 1** constituye el MVP (Producto Mínimo Viable) requerido para el primer entregable, demostrando el flujo de pedido de punta a punta. Las fases siguientes añadirán complejidad, integraciones externas y módulos de soporte.

### **🚨 FASE 1: Flujo Crítico del Pedido (PRIMER ENTREGABLE)**

**Objetivo:** Permitir que un cliente se autentique, vea la carta, arme un pedido, pague y vea cómo el estado cambia hasta ser entregado.  
**Prioridad:** Alta (Obligatoria para el Entregable 1).

| Microservicio | Rol | Alcance de Desarrollo | Omisiones (Fase 1\)   |
| :---- | :---- | :---- | :---- |
| **1.1 Autenticación** (ms-autenticacion) | Puerta de entrada al sistema. | Endpoint de Registro de clientes (RF01). Endpoint de Inicio de Sesión (RF02). Generación y validación de Token JWT. Cifrado de contraseña con BCrypt (RNF02). | Verificación en dos pasos (2FA) y bloqueo por IP (RF05, RF06). Se dejan para la Fase 4\. |
| **1.2 Carta y Productos** (ms-carta-productos) | Mostrar el inventario visual disponible para el cliente. | CRUD de productos para el administrador (RF08). Endpoint de listado de productos con precios y foto (RF09). Opción para marcar producto como "Agotado" (RF10). | Promociones/combos complejos (RF11). El QR físico será simulado con un link directo (RF12). |
| **1.3 Pedidos y Estados** (ms-pedidos) | El cerebro del sistema. Gestiona el ciclo de vida del pedido. | Endpoint para crear pedido (RF15, RF16). **Máquina de Estados:** Pendiente\_Pago \-\> Pagado \-\> En\_Preparación \-\> Listo\_Cocina \-\> En\_Reparto \-\> Completado. Endpoints de actualización de estado (RF19). Consulta de estado en tiempo real (RF17, RF18). | Asignación automática de repartidor (RF20). Se asignará manualmente. |
| **1.4 Pagos** (ms-pagos) | Validar la transacción para avanzar el estado. | Endpoint de intención de pago (RF21). Registro de transacción (RF22). **Comunicación REST** con ms-pedidos para cambiar estado (RF23). | Integración real externa. Se usará un "Mock" que apruebe automáticamente. |

*(Fin del Primer Entregable. A partir de aquí, desarrollo continuo)*

### **🔄 FASE 2: Operatividad en Salón y Tiempo Real**

**Objetivo:** Mejorar la experiencia operativa del mozo y la cocina en tiempo real. **Prioridad:** Media.

> * **2.1 Gestión de Mesas (ms-mesas):** Visualización de mapa de mesas, cambio de estado (Libre/Ocupada), vinculación de mesa a ID de pedido del ms-pedidos (RF13, RF14).  
> * **2.2 Notificaciones \- WebSockets (ms-notificaciones):** Implementar WebSockets. Evento Push en tiempo real a la tablet del Mozo cuando el Chef cambie el estado a Listo\_Cocina (RF32, RNF13).

### **📲 FASE 3: Integraciones Externas y Post-Venta**

**Objetivo:** Conectar servicios de terceros y habilitar el módulo de reseñas. **Prioridad:** Media-Baja.

> * **3.1 Notificaciones \- WhatsApp (ms-notificaciones):** Integrar WhatsApp.js. Enviar mensajes al confirmar pago y actualizar estado de delivery. Cola de espera de 10s (RF30, RNF10).  
> * **3.2 Pagos \- Pasarela Real (ms-pagos):** Sustituir el "Mock" por integración real con API de Yape/Plin (RNF03).  
> * **3.3 Feedback y Reseñas (ms-feedback):** Calificaciones (1-5 estrellas), reporte de problemas con fotos (RF37), Dashboard para atención de reportes (RF38, RF39).

### **🏢 FASE 4: Backoffice, Inventario y Seguridad Avanzada**

**Objetivo:** Completar las operaciones internas de la pollería y blindar el sistema. **Prioridad:** Baja.

> * **4.1 Inventario y Almacén (ms-inventario):** Despacho a cocina, mermas, métricas de rentabilidad cruzadas con ms-pedidos (RF25, RF26, RF27).  
> * **4.2 Finanzas (ms-finanzas):** Centralización de ingresos validados y caja de salón. Emisión de reembolsos.  
> * **4.3 Seguridad Avanzada:** Bloqueo automático de IP tras intentos fallidos (RF05) y 2FA para el personal con Spring Mail (RF06).  
> * **4.4 Incidentes e Infraestructura (ms-incidentes):** Registro de incidentes (RF33), logs centralizados y configuración de variables de entorno (RF35).

## **2\. RECOMENDACIONES DE TRABAJO POR MICROSERVICIO**

Para asegurar que no se atrasen en el primer entregable, el equipo debe seguir esta regla de oro al desarrollar cada microservicio de la Fase 1:

1. **Base de Datos Independiente:** Cada microservicio debe tener su propia base de datos (ej. un schema distinto en PostgreSQL o bases separadas). No compartir tablas.  
2. **Comunicación Síncrona Inicial (Arquitectura REST):** Para la Fase 1, los microservicios se llamarán entre sí mediante **API REST** (ej. ms-pagos llama a ms-pedidos por protocolo HTTP/REST para actualizar el estado). En fases posteriores, de ser necesario por latencia, se migrará a mensajería asíncrona (RabbitMQ o Kafka).  
3. **Frontend Angular por Módulo:** Desarrollar pantallas funcionales que consuman estos endpoints:  
   * *Vista Cliente:* Login, Carta, Carrito de compra, Estado de pedido.  
   * *Vista Cocina/Admin:* Lista de pedidos pendientes, botón para cambiar estado.