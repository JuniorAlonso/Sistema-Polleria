# 1.2 Carta y Productos — `orders-service` (módulo Productos)

**Base URL:** `http://localhost:8082`

**Rol:** Mostrar el inventario visual disponible para el cliente. CRUD de productos para el administrador.

---

## Entidades

### Producto
| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | `Long` | PK, auto-increment |
| `nombre` | `String` | Not null, max 100 |
| `descripcion` | `String` | Max 500 |
| `precio` | `BigDecimal(10,2)` | Not null |
| `categoria` | `Categoria` (enum) | Not null |
| `imagenUrl` | `String` | Max 500 |
| `disponible` | `boolean` | Not null, default `true` |
| `creadoEn` | `LocalDateTime` | Auto-generado, no editable |
| `actualizadoEn` | `LocalDateTime` | Auto-actualizado |

### Categoria (Enum)
```java
POLLO_ENTERO, MEDIO_POLLO, CUARTO_POLLO, COMBO,
PARRILLA, GUARNICION, BEBIDA, POSTRE, PROMOCION
```

---

## Endpoints

### 1. Listar Productos — Carta Pública (RF09, RF12)

```
GET /productos
```

**Acceso:** 🔓 **Público** (sin token). Esto permite que el QR físico de una mesa enlace directamente a la carta.

**Query Params:**
| Parámetro | Tipo | Default | Descripción |
| :--- | :--- | :--- | :--- |
| `categoria` | `string` | — | Filtrar por categoría (ej: `COMBO`, `BEBIDA`) |
| `soloDisponibles` | `boolean` | `true` | `true` = solo productos disponibles; `false` = todos |

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "nombre": "Pollo Entero a la Brasa",
    "descripcion": "1 Pollo a la brasa con papas fritas y ensalada.",
    "precio": 65.00,
    "categoria": "POLLO_ENTERO",
    "imagenUrl": "https://cdn.sanpollo.pe/pollo-entero.jpg",
    "disponible": true,
    "creadoEn": "2026-08-20T10:00:00"
  },
  {
    "id": 2,
    "nombre": "Combo Familiar Fuego Criollo",
    "descripcion": "1 Pollo + Papas Nativas + Ensalada + Gaseosa 1.5L + 4 Cremas.",
    "precio": 74.90,
    "categoria": "COMBO",
    "imagenUrl": "https://cdn.sanpollo.pe/combo-familiar.jpg",
    "disponible": true,
    "creadoEn": "2026-08-20T10:00:00"
  }
]
```

**Ejemplos de uso desde el frontend:**
```
GET /productos                              → Todos los disponibles
GET /productos?categoria=COMBO              → Solo combos disponibles
GET /productos?soloDisponibles=false         → Todos (incluye agotados, para admin)
GET /productos?categoria=BEBIDA&soloDisponibles=false  → Todas las bebidas
```

---

### 2. Obtener Producto por ID

```
GET /productos/{id}
```

**Acceso:** 🔓 **Público** (sin token)

**Response `200 OK`:**
```json
{
  "id": 1,
  "nombre": "Pollo Entero a la Brasa",
  "descripcion": "1 Pollo a la brasa con papas fritas y ensalada.",
  "precio": 65.00,
  "categoria": "POLLO_ENTERO",
  "imagenUrl": "https://cdn.sanpollo.pe/pollo-entero.jpg",
  "disponible": true,
  "creadoEn": "2026-08-20T10:00:00"
}
```

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | `"Producto no encontrado: {id}"` |

---

### 3. Crear Producto (RF08)

```
POST /productos
```

**Acceso:** 🔒 Requiere `Authorization: Bearer <token>` con rol `ADMIN`

**Request Body:**
```json
{
  "nombre": "Chicha Morada Artesanal 1L",
  "descripcion": "Receta tradicional con maíz morado, piña y membrillo.",
  "precio": 14.00,
  "categoria": "BEBIDA",
  "imagenUrl": "https://cdn.sanpollo.pe/chicha.jpg",
  "disponible": true
}
```

| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `nombre` | `string` | ✅ | Max 100 chars |
| `descripcion` | `string` | ❌ | Max 500 chars |
| `precio` | `number` | ✅ | > 0.01 |
| `categoria` | `string` | ✅ | Enum `Categoria` |
| `imagenUrl` | `string` | ❌ | URL de la imagen |
| `disponible` | `boolean` | ❌ | Default `true` |

**Response `201 Created`:** _(mismo formato que ProductoResponse)_

---

### 4. Actualizar Producto (RF08)

```
PUT /productos/{id}
```

**Acceso:** 🔒 Solo `ADMIN`

**Request Body:** _(mismo formato que crear)_

**Response `200 OK`:** ProductoResponse actualizado

---

### 5. Marcar como Agotado / Disponible (RF10)

```
PATCH /productos/{id}/disponibilidad
```

**Acceso:** 🔒 Solo `ADMIN`

**Request Body:** Ninguno. Es un toggle — cada llamada invierte el estado `disponible`.

**Response `200 OK`:**
```json
{
  "id": 3,
  "nombre": "1/4 de Pollo",
  "disponible": false,
  ...
}
```

**Comportamiento:**
- Si `disponible = true` → se cambia a `false` (Agotado)
- Si `disponible = false` → se cambia a `true` (Disponible)
- Un producto marcado como agotado NO puede ser incluido en nuevos pedidos (validado en `OrdenService`)

---

### 6. Eliminar Producto (RF08)

```
DELETE /productos/{id}
```

**Acceso:** 🔒 Solo `ADMIN`

**Response `204 No Content`**

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | `"Producto no encontrado: {id}"` |

---

## Promociones y Combos (RF11)

Los combos y promociones se manejan como productos regulares con las categorías `COMBO` y `PROMOCION`:

- **Combo:** Producto con descripción detallada de qué incluye, precio total y foto.
- **Promoción:** Igual que combo pero temporal. El admin puede marcar `disponible = false` cuando la promo expire.

No hay entidad separada de "promoción con reglas"; el combo/promo es un producto con descripción rica.

---

## QR Físico Simulado (RF12)

La carta es **pública** (`permitAll()` en `SecurityConfig`). Un código QR en la mesa del restaurante simplemente enlaza a:

```
https://sanpollo.pe/menu?mesa=5
```

El frontend recibe el param `mesa` y lo usa al crear el pedido tipo `SALON`.

---

## Uso desde el Frontend

```typescript
// Listar carta pública (no requiere token)
const resp = await fetch('http://localhost:8082/productos');
const productos: ProductoResponse[] = await resp.json();

// Filtrar por categoría
const combos = await fetch('http://localhost:8082/productos?categoria=COMBO');

// Admin: crear producto (requiere token ADMIN)
await fetch('http://localhost:8082/productos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    nombre: 'Nuevo Combo',
    precio: 89.90,
    categoria: 'COMBO',
    descripcion: '...',
    disponible: true
  })
});

// Admin: toggle agotado
await fetch(`http://localhost:8082/productos/${id}/disponibilidad`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```
