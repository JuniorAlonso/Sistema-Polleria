# Pruebas REST end to end - Sistema Pollería

Suite `.http` que recorre todos los endpoints del backend (7 servicios) con flujos completos, RBAC y casos negativos.
Se usa de dos formas: a mano con la extensión **REST Client** (`humao.rest-client`) o automática con el runner incluido.

## Requisitos

- Backend local levantado: `docker compose -f polleria/docker-compose.local.yml up -d`
- Node 18+ (solo para el runner; no tiene dependencias)
- Docker CLI accesible (el runner lee los códigos 2FA desde `polleria-postgres`)

## Archivos

| Archivo | Cobertura |
|---|---|
| `00-smoke-y-sesiones.http` | Disponibilidad de los 7 servicios y login de los 6 roles sembrados (con 2FA) |
| `01-auth.http` | auth-service: registro, login, 2FA, refresh/rotación, logout, validate, admin, sanciones |
| `02-catalogo-mesas-zonas.http` | orders-service: productos (imagen, stock, disponibilidad), zonas y mesas |
| `03-ordenes.http` | orders-service: órdenes SALON/DELIVERY/RECOJO, máquina de estados, reparto, seguimiento |
| `04-pagos.http` | payments-service: métodos de pago, efectivo y liquidación, comprobantes, reembolsos, webhook |
| `05-finanzas.http` | finance-service: caja, comprobantes, liquidaciones de repartidor, balance diario |
| `06-feedback-incidentes.http` | feedback-service (reseñas, reportes, devoluciones) e incident-service |
| `07-notificaciones.http` | notification-service: WhatsApp, ajustes, historial, QR, estado |

Cada archivo es autónomo: inicia sesión con los roles que necesita, crea sus propios datos y los limpia al final,
así que se puede ejecutar solo y repetir sin limpieza manual.

## Ejecutar con el runner

```bash
cd rest-tests
node runner/run-http.mjs                         # todos los archivos
node runner/run-http.mjs 03-ordenes.http         # uno solo
node runner/run-http.mjs --bail --verbose 04-pagos.http
```

Termina con `TOTAL: N ok, M failed` y código de salida distinto de 0 si algo falla.

## Ejecutar con REST Client

1. Abre un `.http` y pulsa **Send Request** en cada bloque, en orden.
2. Roles con 2FA (ADMIN, MOZO, COCINA, REPARTIDOR, CAJERO): tras el paso 1 del login, copia el código del correo
   (o de la tabla `two_factor_tokens`) en la variable `@OTP_<ROL>` del archivo y envía el paso 2.
3. Las claves internas se leen con `{{$dotenv ...}}`: crea `rest-tests/.env` (ignorado por git) con
   `INTERNAL_API_KEY` y `NOTIFICATION_API_KEY` copiadas de `polleria/.env`. El runner lee `polleria/.env` directamente.

## Convenciones del formato

| Línea | Significado |
|---|---|
| `# Esperado: HTTP 200` | Estado esperado (el runner lo exige en cada petición) |
| `# @assert $.estado == LISTO` | Aserción JSON (`==`, `!=`, `>=`, `<=`, `contains`, `exists`, `notExists`) |
| `# @name loginAdmin` | Guarda la respuesta: `{{loginAdmin.response.body.$.token}}` |
| `# @otp OTP_ADMIN correo` | Solo runner: carga el último código 2FA pendiente de ese usuario |
| `# @sql VAR SELECT ...` | Solo runner: lee un código que el usuario recibiría fuera de banda (WhatsApp/correo) |
| `[BUG]` en el título | Petición que espera el comportamiento correcto y hoy falla por un defecto conocido del backend |

Las peticiones anónimas a endpoints protegidos devuelven **403** (contrato que asume el interceptor del frontend), no 401.

## Usuarios sembrados

Contraseña `Password123!`: `admin`, `mozo`, `cocina`, `repartidor`, `cajero`, `cliente` `.polleria@yopmail.com`.
