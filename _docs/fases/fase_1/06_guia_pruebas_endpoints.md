# Guía de Pruebas de Endpoints — Fase 1

Guía paso a paso para probar todos los endpoints de los microservicios desde un cliente REST (Postman, Insomnia, Thunder Client o cURL).

---

## 1. Requisitos Previos

### 1.1 Levantar los servicios

```bash
# Desde polleria/
docker compose -f docker-compose.local.yml up -d
```

Verificar que los 4 servicios estén arriba:

| Servicio | URL de prueba | Esperado |
| :--- | :--- | :--- |
| auth-service | `GET http://localhost:8081/auth/validate` | `401` (sin token) |
| orders-service | `GET http://localhost:8082/productos` | `200` + lista |
| payments-service | `GET http://localhost:8083/pagos` | `401` (sin token) |
| notification-service | `GET http://localhost:3001/status` | `200` + `{ status: "ok" }` |

### 1.2 Herramienta recomendada

- **Postman** (recomendado): Permite crear colecciones, variables de entorno y scripts de pre-request.
- **Thunder Client** (VS Code): Extensión ligera integrada al editor.
- **Insomnia**: Alternativa open-source.
- **cURL**: Línea de comandos, ejemplos incluidos abajo.

### 1.3 Configurar variables de entorno (Postman / Insomnia)

Crear un Environment con estas variables:

| Variable | Valor inicial |
| :--- | :--- |
| `AUTH_URL` | `http://localhost:8081` |
| `ORDERS_URL` | `http://localhost:8082` |
| `PAYMENTS_URL` | `http://localhost:8083` |
| `NOTIF_URL` | `http://localhost:3001` |
| `TOKEN` | *(se llena automáticamente al hacer login)* |

> **Tip Postman**: En la pestaña *Tests* del request de login, añadir:
> ```javascript
> const res = pm.response.json();
> if (res.token) {
>     pm.environment.set("TOKEN", res.token);
> }
> ```
> Así `{{TOKEN}}` se actualiza automáticamente.

---

## 2. Flujo de Pruebas Recomendado

Seguir este orden para evitar dependencias rotas:

```
1. Registrar usuario ADMIN
2. Login → obtener TOKEN
3. Crear productos (necesita ADMIN)
4. Crear mesas (necesita ADMIN)
5. Registrar usuario CLIENTE
6. Login como CLIENTE → TOKEN_CLIENTE
7. Crear orden (necesita TOKEN + productos existentes)
8. Iniciar pago (necesita orden creada)
9. Flujo de estados (preparación → listo → entregado)
```

---

## 3. auth-service (`:8081`)

### 3.1 Registrar usuario

```
POST http://localhost:8081/auth/register
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Admin San Pollo",
  "email": "admin@sanpollo.com",
  "phone": "987654321",
  "password": "admin123",
  "role": "ADMIN"
}
```

**Roles válidos:** `CLIENTE`, `MOZO`, `COCINA`, `ADMIN`, `REPARTIDOR`

**Respuesta esperada (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "name": "Admin San Pollo",
  "email": "admin@sanpollo.com",
  "role": "ADMIN",
  "requiresTwoFactor": false,
  "message": null
}
```

**cURL:**
```bash
curl -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin San Pollo","email":"admin@sanpollo.com","phone":"987654321","password":"admin123","role":"ADMIN"}'
```

---

### 3.2 Login

```
POST http://localhost:8081/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "identifier": "admin@sanpollo.com",
  "password": "admin123"
}
```

> `identifier` acepta email o número de teléfono.

**Respuesta esperada (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "name": "Admin San Pollo",
  "email": "admin@sanpollo.com",
  "role": "ADMIN",
  "requiresTwoFactor": false,
  "message": null
}
```

> ⚠️ Si `requiresTwoFactor` es `true`, el `token` será `null`. Proceder con verify-2fa.

**cURL:**
```bash
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@sanpollo.com","password":"admin123"}'
```

---

### 3.3 Verificar 2FA

> Solo necesario si el login devolvió `requiresTwoFactor: true`. El código se envía al email del usuario.

```
POST http://localhost:8081/auth/verify-2fa
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@sanpollo.com",
  "code": "123456"
}
```

---

### 3.4 Validar token

```
GET http://localhost:8081/auth/validate
Authorization: Bearer {{TOKEN}}
```

**Respuesta esperada (200):**
```json
{
  "valid": true,
  "email": "admin@sanpollo.com",
  "role": "ADMIN"
}
```

**cURL:**
```bash
curl http://localhost:8081/auth/validate \
  -H "Authorization: Bearer <tu-token>"
```

---

## 4. orders-service — Productos (`:8082`)

### 4.1 Listar productos (público)

```
GET http://localhost:8082/productos
```

**Query params opcionales:**

| Param | Valores | Default |
| :--- | :--- | :--- |
| `categoria` | `POLLO_ENTERO`, `MEDIO_POLLO`, `CUARTO_POLLO`, `COMBO`, `PARRILLA`, `GUARNICION`, `BEBIDA`, `POSTRE`, `PROMOCION` | — |
| `soloDisponibles` | `true` / `false` | `true` |

**Ejemplos:**
```
GET http://localhost:8082/productos?categoria=COMBO
GET http://localhost:8082/productos?soloDisponibles=false
GET http://localhost:8082/productos?categoria=BEBIDA&soloDisponibles=false
```

---

### 4.2 Obtener producto por ID

```
GET http://localhost:8082/productos/1
```

---

### 4.3 Crear producto (ADMIN)

```
POST http://localhost:8082/productos
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Pollo Entero con Papas",
  "descripcion": "Pollo a la brasa entero con papas fritas y ensalada",
  "precio": 55.90,
  "categoria": "POLLO_ENTERO",
  "imagenUrl": "https://ejemplo.com/pollo-entero.jpg",
  "disponible": true
}
```

**Respuesta esperada (201):** Objeto `ProductoResponse` con `id` asignado.

**cURL:**
```bash
curl -X POST http://localhost:8082/productos \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Pollo Entero con Papas","descripcion":"Pollo a la brasa entero con papas fritas y ensalada","precio":55.90,"categoria":"POLLO_ENTERO","imagenUrl":"","disponible":true}'
```

---

### 4.4 Actualizar producto (ADMIN)

```
PUT http://localhost:8082/productos/1
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:** Mismo formato que crear. Todos los campos se sobreescriben.

---

### 4.5 Toggle disponibilidad (ADMIN)

```
PATCH http://localhost:8082/productos/1/disponibilidad
Authorization: Bearer {{TOKEN}}
```

> Sin body. Alterna entre `disponible: true` y `false`.

---

### 4.6 Eliminar producto (ADMIN)

```
DELETE http://localhost:8082/productos/1
Authorization: Bearer {{TOKEN}}
```

**Respuesta esperada: `204 No Content`**

---

## 5. orders-service — Mesas (`:8082`)

### 5.1 Listar todas las mesas (ADMIN, MOZO)

```
GET http://localhost:8082/mesas
Authorization: Bearer {{TOKEN}}
```

---

### 5.2 Listar mesas libres (ADMIN, MOZO)

```
GET http://localhost:8082/mesas/libres
Authorization: Bearer {{TOKEN}}
```

---

### 5.3 Obtener mesa por ID (ADMIN, MOZO)

```
GET http://localhost:8082/mesas/1
Authorization: Bearer {{TOKEN}}
```

---

### 5.4 Crear mesa (ADMIN)

```
POST http://localhost:8082/mesas
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "numero": 1,
  "capacidad": 4
}
```

**cURL:**
```bash
curl -X POST http://localhost:8082/mesas \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"numero":1,"capacidad":4}'
```

---

### 5.5 Cambiar estado de mesa (ADMIN, MOZO)

```
PATCH http://localhost:8082/mesas/1/estado
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "estado": "OCUPADA"
}
```

**Estados válidos:** `LIBRE`, `OCUPADA`, `RESERVADA`

---

### 5.6 Eliminar mesa (ADMIN)

```
DELETE http://localhost:8082/mesas/1
Authorization: Bearer {{TOKEN}}
```

**Respuesta esperada: `204 No Content`**

---

## 6. orders-service — Órdenes (`:8082`)

### 6.1 Crear orden

```
POST http://localhost:8082/ordenes
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body — Pedido de salón:**
```json
{
  "tipo": "SALON",
  "mesaId": 1,
  "observaciones": "Sin ají",
  "items": [
    { "productoId": 1, "cantidad": 2, "notas": "Extra papas" },
    { "productoId": 3, "cantidad": 1, "notas": null }
  ]
}
```

**Body — Pedido delivery:**
```json
{
  "tipo": "DELIVERY",
  "direccionEntrega": "Av. Los Maestros 123, Ica",
  "referencia": "Frente al parque",
  "nombreCliente": "Juan Pérez",
  "telefonoCliente": "987654321",
  "observaciones": "Tocar timbre 2 veces",
  "items": [
    { "productoId": 1, "cantidad": 1, "notas": "" }
  ]
}
```

**Body — Pedido recojo:**
```json
{
  "tipo": "RECOJO",
  "nombreCliente": "María García",
  "telefonoCliente": "912345678",
  "items": [
    { "productoId": 2, "cantidad": 1, "notas": "Sin ensalada" }
  ]
}
```

**Tipos válidos:** `SALON`, `DELIVERY`, `RECOJO`

**cURL:**
```bash
curl -X POST http://localhost:8082/ordenes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"DELIVERY","direccionEntrega":"Av. Los Maestros 123","referencia":"Frente al parque","nombreCliente":"Juan","telefonoCliente":"987654321","items":[{"productoId":1,"cantidad":2}]}'
```

---

### 6.2 Consultar orden por ID

```
GET http://localhost:8082/ordenes/1
Authorization: Bearer {{TOKEN}}
```

---

### 6.3 Mis órdenes (historial del cliente autenticado)

```
GET http://localhost:8082/ordenes/mis-ordenes
Authorization: Bearer {{TOKEN}}
```

---

### 6.4 Órdenes para cocina (ADMIN, COCINA)

```
GET http://localhost:8082/ordenes/cocina
Authorization: Bearer {{TOKEN}}
```

> Devuelve órdenes con estado `RECIBIDO` y `EN_PREPARACION`.

---

### 6.5 Órdenes activas (ADMIN, MOZO)

```
GET http://localhost:8082/ordenes/activos
Authorization: Bearer {{TOKEN}}
```

---

### 6.6 Listar con filtros

```
GET http://localhost:8082/ordenes
GET http://localhost:8082/ordenes?estado=RECIBIDO
GET http://localhost:8082/ordenes?soloActivos=true
```

Todas requieren `Authorization: Bearer {{TOKEN}}`.

---

### 6.7 Cambiar estado de orden

```
PATCH http://localhost:8082/ordenes/1/estado
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "estado": "EN_PREPARACION",
  "repartidorId": null
}
```

**Flujo completo de estados:**
```
RECIBIDO → EN_PREPARACION → LISTO → EN_CAMINO (solo delivery) → ENTREGADO
                                  ↘ ENTREGADO (salón/recojo)
Cualquier estado → CANCELADO
```

**Estados válidos:** `RECIBIDO`, `EN_PREPARACION`, `LISTO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO`

> Para `EN_CAMINO` en delivery, incluir `repartidorId`.

**cURL:**
```bash
curl -X PATCH http://localhost:8082/ordenes/1/estado \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"estado":"EN_PREPARACION"}'
```

---

## 7. payments-service — Pagos (`:8083`)

### 7.1 Iniciar pago

```
POST http://localhost:8083/pagos
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body — Contraentrega:**
```json
{
  "ordenId": 1,
  "monto": 55.90,
  "metodoPago": "CONTRAENTREGA",
  "tokenPasarela": null,
  "telefonoYape": null
}
```

**Body — Yape/Plin:**
```json
{
  "ordenId": 1,
  "monto": 55.90,
  "metodoPago": "YAPE_PLIN",
  "tokenPasarela": null,
  "telefonoYape": "987654321"
}
```

**Body — Tarjeta:**
```json
{
  "ordenId": 1,
  "monto": 55.90,
  "metodoPago": "TARJETA",
  "tokenPasarela": "tok_test_abcdef123456",
  "telefonoYape": null
}
```

**Métodos válidos:** `CONTRAENTREGA`, `TARJETA`, `YAPE_PLIN`

**cURL:**
```bash
curl -X POST http://localhost:8083/pagos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"ordenId":1,"monto":55.90,"metodoPago":"CONTRAENTREGA"}'
```

---

### 7.2 Crear preferencia Mercado Pago

```
POST http://localhost:8083/pagos/mercadopago/preferencia
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:** Mismo formato que iniciar pago.

**Respuesta:** URL de checkout para redirigir al cliente.

---

### 7.3 Obtener pago por ID

```
GET http://localhost:8083/pagos/1
Authorization: Bearer {{TOKEN}}
```

---

### 7.4 Pago por orden

```
GET http://localhost:8083/pagos/orden/1
Authorization: Bearer {{TOKEN}}
```

---

### 7.5 Mis pagos (CLIENTE, MOZO)

```
GET http://localhost:8083/pagos/mis-pagos
Authorization: Bearer {{TOKEN}}
```

---

### 7.6 Todos los pagos (ADMIN)

```
GET http://localhost:8083/pagos
Authorization: Bearer {{TOKEN}}
```

---

### 7.7 Confirmar pago (ADMIN, REPARTIDOR)

```
PATCH http://localhost:8083/pagos/1/confirmar
Authorization: Bearer {{TOKEN}}
Content-Type: application/json
```

**Body:**
```json
{
  "referenciaExterna": "REF-MANUAL-001",
  "detalle": "Pago recibido en efectivo al repartidor"
}
```

**cURL:**
```bash
curl -X PATCH http://localhost:8083/pagos/1/confirmar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"referenciaExterna":"REF-MANUAL-001","detalle":"Pago recibido en efectivo"}'
```

---

### 7.8 Cancelar pago (ADMIN, CLIENTE)

```
PATCH http://localhost:8083/pagos/1/cancelar
Authorization: Bearer {{TOKEN}}
```

> Sin body requerido.

---

### 7.9 Webhook Mercado Pago (público)

```
POST http://localhost:8083/pagos/webhook/mercadopago?type=payment&data.id=12345
Content-Type: application/json
```

**Body (simulación):**
```json
{
  "action": "payment.created",
  "type": "payment",
  "data": {
    "id": "12345"
  }
}
```

> Este endpoint es público (sin auth). En producción, lo llama Mercado Pago automáticamente.

---

## 8. notification-service (`:3001`)

### 8.1 Health check

```
GET http://localhost:3001/status
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "whatsapp": "connected"
}
```

> Si dice `"waiting_qr"`, se debe escanear el QR que aparece en la consola del servicio.

---

### 8.2 Enviar notificación WhatsApp

> Este endpoint es de **uso inter-servicio** (orders-service lo llama al cambiar estado). Se puede probar manualmente.

```
POST http://localhost:3001/notificar
Content-Type: application/json
```

**Body:**
```json
{
  "telefono": "987654321",
  "orderId": 1,
  "estado": "RECIBIDO",
  "nombreCliente": "Juan Pérez"
}
```

**Estados y mensajes:**

| Estado | Mensaje enviado |
| :--- | :--- |
| `RECIBIDO` | ✅ Hola *Juan*, tu pedido *#1* fue recibido y está en cola. 🍗 |
| `EN_PREPARACION` | 👨‍🍳 Tu pedido *#1* está siendo preparado. ¡Ya casi! |
| `LISTO` | 🔔 Tu pedido *#1* está *listo*. ¡Lo estamos empacando! |
| `EN_CAMINO` | 🛵 Tu pedido *#1* va *en camino*. El repartidor está cerca. |
| `ENTREGADO` | 🎉 Pedido *#1* entregado. ¡Buen provecho! |
| `CANCELADO` | ❌ Tu pedido *#1* fue cancelado. |

**cURL:**
```bash
curl -X POST http://localhost:3001/notificar \
  -H "Content-Type: application/json" \
  -d '{"telefono":"987654321","orderId":1,"estado":"RECIBIDO","nombreCliente":"Juan"}'
```

---

## 9. Escenario de Prueba Completo (E2E)

Secuencia completa para validar todo el flujo de negocio:

```
Paso  Endpoint                                 Acción
────  ───────────────────────────────────────  ──────────────────────────────────
 1.   POST /auth/register                      Crear ADMIN
 2.   POST /auth/login                         Login ADMIN → guardar TOKEN_ADMIN
 3.   POST /productos (×3)                     Crear 3 productos de prueba
 4.   POST /mesas                              Crear mesa #1 (capacidad 4)
 5.   GET  /productos                          Verificar carta pública
 6.   POST /auth/register                      Crear CLIENTE
 7.   POST /auth/login                         Login CLIENTE → guardar TOKEN_CLIENTE
 8.   POST /ordenes                            Crear orden DELIVERY (con TOKEN_CLIENTE)
 9.   GET  /ordenes/{id}                       Verificar estado = RECIBIDO
10.   POST /pagos                              Iniciar pago CONTRAENTREGA (con TOKEN_CLIENTE)
11.   GET  /pagos/orden/{ordenId}              Verificar pago asociado
12.   PATCH /ordenes/{id}/estado               EN_PREPARACION (con TOKEN_ADMIN)
13.   PATCH /ordenes/{id}/estado               LISTO (con TOKEN_ADMIN)
14.   PATCH /ordenes/{id}/estado               EN_CAMINO + repartidorId
15.   PATCH /pagos/{id}/confirmar              Confirmar pago (repartidor recibió efectivo)
16.   PATCH /ordenes/{id}/estado               ENTREGADO
17.   GET  /ordenes/mis-ordenes                Verificar historial del cliente
18.   GET  /pagos/mis-pagos                    Verificar historial de pagos
```

---

## 10. Errores Comunes y Troubleshooting

| Código | Causa probable | Solución |
| :---: | :--- | :--- |
| `401` | Token faltante, expirado o inválido | Hacer login nuevamente |
| `403` | Rol insuficiente para el endpoint | Usar usuario con rol correcto |
| `400` | Body con campos faltantes o inválidos | Revisar campos `@NotNull` / `@NotBlank` |
| `404` | Recurso no encontrado (producto, orden, etc.) | Verificar que el ID existe |
| `409` | Conflicto (email duplicado, estado inválido) | Revisar reglas de negocio |
| `500` | Error interno del servicio | Revisar logs del contenedor: `docker logs polleria-auth-service` |

### Verificar logs de un servicio

```bash
docker logs -f polleria-auth-service
docker logs -f polleria-orders-service
docker logs -f polleria-payments-service
```

### Reiniciar un servicio

```bash
docker compose -f docker-compose.local.yml restart auth-service
```

---

## 11. Referencia de Enums

### Roles de usuario
`CLIENTE` · `MOZO` · `COCINA` · `ADMIN` · `REPARTIDOR`

### Categorías de producto
`POLLO_ENTERO` · `MEDIO_POLLO` · `CUARTO_POLLO` · `COMBO` · `PARRILLA` · `GUARNICION` · `BEBIDA` · `POSTRE` · `PROMOCION`

### Tipos de orden
`SALON` · `DELIVERY` · `RECOJO`

### Estados de orden
`RECIBIDO` · `EN_PREPARACION` · `LISTO` · `EN_CAMINO` · `ENTREGADO` · `CANCELADO`

### Estados de mesa
`LIBRE` · `OCUPADA` · `RESERVADA`

### Métodos de pago
`CONTRAENTREGA` · `TARJETA` · `YAPE_PLIN`
