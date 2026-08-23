![](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.001.png)

![Archivo:Utplogonuevo.svg - Wikipedia, la enciclopedia libre](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.002.png)


![](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.003.png)





















![](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.004.png)













![](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.005.png)





**REQUERIMIENTOS DEL SISTEMA** 

Sistema de Pedidos y Delivery para Pollería – Arquitectura de Microservicios 

**1. REQUERIMIENTOS FUNCIONALES**

|**CÓDIGO**|**MÓDULO**|**DESCRIPCIÓN**||
| :-: | :-: | :-: | :- |
|**RF01**|Autenticación|El sistema permitirá registrar clientes capturando sus datos básicos (nombre, correo, celular y contraseña).||
|**RF02**|Autenticación|El sistema permitirá a los usuarios iniciar sesión mediante su correo o celular y contraseña.||
|**RF03**|Autenticación|El sistema permitirá a los usuarios cerrar sesión activa.||
|**RF04**|Autenticación|El sistema requerirá verificación en dos pasos para el inicio de sesión del personal y administradores, enviando un código de validación a su correo.||
|**RF05**|Autenticación|El sistema bloqueará temporalmente el acceso a usuarios tras múltiples intentos fallidos de inicio de sesión.||
|**RF06**|Carta y Productos|El sistema permitirá al administrador gestionar (crear, editar, eliminar y listar) los productos de la carta.||
|**RF07**|Carta y Productos|El sistema permitirá a los clientes visualizar la carta de productos, incluyendo precios e imágenes.||
|**RF08**|Carta y Productos|El sistema permitirá al administrador marcar productos como "agotados", ocultándolos de la carta disponible.||
|**RF09**|Carta y Productos|El sistema permitirá crear y gestionar promociones y combos de productos.||
|**RF10**|Carta y Productos|El sistema permitirá a los clientes acceder a la carta digital mediante el escaneo de un código QR en la mesa.||
|**RF11**|Gestión de Mesas|El sistema permitirá al mozo visualizar el estado de las mesas, registrar su ocupación y vincularlas a una nueva orden.||
|**RF12**|Gestión de Mesas|El sistema permitirá al mozo registrar los pedidos de salón en un dispositivo móvil tras la selección presencial del cliente.||
|**RF13**|Pedidos y Estados|El sistema permitirá registrar pedidos para consumo en salón (por el mozo), delivery o recojo (por el cliente).||
|**RF14**|Pedidos y Estados|El sistema requerirá el registro de dirección y una referencia de ubicación para pedidos de delivery.||
|**RF15**|Pedidos y Estados|El sistema gestionará el ciclo de vida de los pedidos mediante una máquina de estados robusta (Pendiente, Pagado, En Preparación, Listo, En Reparto, Completado, Cancelado).||
|**RF16**|Pedidos y Estados|El sistema permitirá al personal de cocina y administración actualizar el estado de los pedidos, validando las transiciones permitidas.||
|**RF17**|Pedidos y Estados|El sistema permitirá a los clientes consultar el estado actual de su pedido.||
|**RF18**|Pedidos y Estados|El sistema asignará automáticamente un repartidor disponible a los pedidos de delivery.||
|**RF19**|Pagos y Finanzas|El sistema permitirá seleccionar métodos de pago: contraentrega, tarjeta o monederos digitales (Yape/Plin).||
|**RF20**|Pagos y Finanzas|El sistema registrará cada transacción con su estado: aprobada, rechazada, pendiente o cancelada.||
|**RF21**|Pagos y Finanzas|El sistema actualizará automáticamente el estado del pedido según el resultado de la pasarela de pagos.||
|**RF22**|Pagos y Finanzas|El sistema registrará centralizadamente los ingresos validados por pasarela (delivery) o cobrados en caja (salón) en el módulo de Finanzas.||
|**RF23**|Inventario|El sistema permitirá al Chef solicitar y registrar el despacho de lotes de insumos hacia la cocina.||
|**RF24**|Inventario|El sistema permitirá al personal registrar la merma de insumos perecibles no vendidos al finalizar la jornada.||
|**RF25**|Inventario|El sistema generará métricas de rentabilidad y alertas predictivas de abastecimiento cruzando ventas, despachos y mermas.||
|**RF26**|Feedback y Reseñas|El sistema permitirá a los clientes calificar (1 a 5 estrellas) y dejar reseñas de sus pedidos completados.||
|**RF27**|Feedback y Reseñas|El sistema permitirá a los clientes reportar problemas de un pedido adjuntando descripción y evidencia fotográfica.||
|**RF28**|Feedback y Reseñas|El sistema permitirá al administrador visualizar, responder y gestionar el estado de las reseñas y reportes de clientes (Abierto, En Revisión, Resuelto).||
|**RF29**|Feedback y Reseñas|El sistema permitirá al administrador emitir reembolsos asociados a reportes procedentes.||
|**RF30**|Notificaciones|El sistema enviará una notificación por WhatsApp al cliente al confirmar el pago de un delivery.||
|**RF31**|Notificaciones|El sistema enviará notificaciones por WhatsApp al cliente cada vez que el estado de su delivery cambie.||
|**RF32**|Notificaciones|El sistema registrará el estado de los envíos de notificaciones (enviado, en cola, fallido).||
|**RF33**|Notificaciones|El sistema enviará notificaciones en tiempo real al dispositivo del mozo indicando qué plato de qué mesa está listo en cocina.||
|**RF34**|Incidentes|El sistema permitirá registrar y documentar incidentes técnicos u operativos, incluyendo causa raíz y solución.||

**2. REQUERIMIENTOS NO FUNCIONALES**

|**Código**|**Descripción**|||
| :-: | :-: | :- | :- |
|**RNF01**|Disponibilidad: El sistema debe estar disponible para los clientes las 24 horas, los 7 días de la semana.|||
|**RNF02**|Seguridad: Las contraseñas siempre se guardarán encriptadas en la base de datos usando el algoritmo BCrypt.|||
|**RNF03**|Seguridad: La comunicación entre el frontend (Angular) y el backend estará protegida mediante HTTPS, validando tokens JWT en cada petición.|||
|**RNF04**|Seguridad: Se configurarán políticas CORS en el backend para restringir el consumo de servicios solo a los frontends autorizados.|||
|**RNF05**|Seguridad: El bloqueo de IPs sospechosas tras intentos fallidos de inicio de sesión se ejecutará automáticamente sin intervención manual.|||
|**RNF06**|Rendimiento: Las notificaciones WebSockets hacia los dispositivos de los mozos deben contar con baja latencia para operar en tiempo real.|||
|**RNF07**|Rendimiento: El estado de los pedidos debe actualizarse casi en tiempo real conforme avanza la preparación.|||
|**RNF08**|Escalabilidad: Al ser arquitectura de microservicios, cada módulo (autenticación, pedidos, pagos, whatsapp, chatbot, finanzas, inventario, feedback) se desplegará en su propio servidor de forma independiente, permitiendo escalar por separado.|||
|**RNF09**|Fiabilidad: Si se cancela un pago, la pasarela debe registrar la cancelación y avisar al sistema de forma automática.|||
|**RNF10**|Fiabilidad: El sistema respetará los límites de la API de WhatsApp.js, esperando un mínimo de 10 segundos entre cada envío para evitar bloqueos.|||
|**RNF11**|Mantenibilidad: El código seguirá buenas prácticas, debiendo documentarse, comentarse y explicarse claramente en los commits de control de versiones (GitHub).|||
|**RNF12**|Mantenibilidad: El sistema podrá moverse entre distintos ambientes (desarrollo, pruebas, producción) mediante el uso de variables de entorno.|||
|**RNF13**|Trazabilidad: Quedarán logs guardados de las transacciones y errores para investigar incidentes.|||
|**RFN14**|Usabilidad: La interfaz del usuario (UI) debe ser responsiva, viéndose bien y siendo fácil de usar desde dispositivos móviles.|||

![](Aspose.Words.5c64285f-e987-4a75-a811-1e920c79ce81.006.png)


