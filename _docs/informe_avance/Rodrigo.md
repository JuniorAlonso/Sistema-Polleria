# Sistema Pollería — Resumen de sesión

Backend completo · Fase 6 desplegada · GitHub sincronizado

11 Oct 2026

7 Microservicios activos

4 Servicios nuevos (Fase 6)

3 JARs recompilados

5 Commits del equipo integrados

**Un compañero subió la Fase 3 completa de WhatsApp** mientras trabajábamos — 5 commits incluyendo cola anti-baneo, seguimiento por código, historial en PostgreSQL y el QR desde el panel admin. Se integró y redespliegó todo automáticamente.

## Correcciones de código

- **Rol CAJERO añadido al enum**

  El `finance-service` usaba `hasAnyAuthority('CAJERO')` pero el enum `Role` en `auth-service` no lo tenía. Se agregó para que el registro de cajas funcione correctamente.

  auth-service/entity/Role.java
- **Rol CHEF → COCINA en inventory-service e incident-service**

  Cuatro controladores usaban `'CHEF'` y `'ROLE_CHEF'` — un rol que no existe en el sistema. El rol correcto es `COCINA`, igual que en orders-service.

  InsumoController DespachoController MermaController InventarioAnalisisController IncidenteController
- **Conflicto de merge resuelto en MesaController**

  El remoto tenía funcionalidades nuevas (posición X/Y, zona, soft-delete). Nuestra versión tenía `@PreAuthorize` que el remoto no traía. Se fusionaron ambas versiones: código nuevo del remoto + anotaciones de seguridad completas.

  orders-service/controller/MesaController.java
- **Conflicto de merge resuelto en GlobalExceptionHandler**

  Remoto traía handler para `NoSuchElementException` (→ 404), nuestra versión tenía handler para `HttpMessageNotReadableException` (→ 400 con valores válidos de Categoría). Se conservaron ambos handlers.

  orders-service/controller/GlobalExceptionHandler.java

## Despliegue de Fase 6

- **4 bases de datos creadas en Amazon RDS**

  `polleria_feedback`, `polleria_inventory`, `polleria_finance` y `polleria_incident` creadas vía psql en el RDS PostgreSQL compartido.
- **Reglas de seguridad añadidas al Security Group**

  Puertos 8085, 8086, 8087 y 8088 abiertos al público en `sg-026368bd2db18fa6d`.
- **4 archivos systemd creados y servicios iniciados**

  Cada servicio nuevo distribuido en EC2s existentes para maximizar la RAM disponible. JVM tuneada a `-Xmx192m -Xss256k` para instancias de 1GB.

  incident → auth-EC2 finance → payments-EC2 feedback → backoffice-EC2 inventory → backoffice-EC2

## Estado final de infraestructura

| Servicio | EC2 IP | Puerto | Estado |
| --- | --- | --- | --- |
| auth-serviceactualizado | 98.86.149.179 | :8081 | activo |
| incident-servicenuevo | 98.86.149.179 | :8088 | activo |
| orders-serviceactualizado | 100.53.223.167 | :8082 | activo |
| payments-serviceactualizado | 44.203.62.89 | :8083 | activo |
| finance-servicenuevo | 44.203.62.89 | :8087 | activo |
| feedback-servicenuevo | 13.220.34.39 | :8085 | activo |
| inventory-servicenuevo | 13.220.34.39 | :8086 | activo |

## Commits integrados del equipo

- 450338a

  feat(admin): vincular WhatsApp escaneando el QR desde el panel

  JuniorAlonso
- 4dcef41

  fix(notificaciones): reinicio de sesión de WhatsApp en Windows (EBUSY)

  JuniorAlonso
- ed3c5b2

  feat(frontend): logo de San Pollo como favicon e íconos de la app

  JuniorAlonso
- e91229f

  fix(payments): agregar import faltante de PaymentClient

  JuniorAlonso
- aec5021

  feat(notificaciones): Fase 3 WhatsApp con cola anti-baneo, historial y seguimiento por celular

  JuniorAlonso

Sistema Pollería · Curso Desarrollo Web Integrado · GitHub en main, todo desplegado en AWS