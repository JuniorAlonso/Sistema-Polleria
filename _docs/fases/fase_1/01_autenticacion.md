# 1.1 Autenticación — `auth-service`

**Base URL:** `http://localhost:8081`

**Rol:** Puerta de entrada al sistema. Maneja registro, login, JWT y seguridad.

---

## Entidades

### User
| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | `Long` | PK, auto-increment |
| `name` | `String` | Not null, max 100 |
| `email` | `String` | Not null, único, lowercase |
| `phone` | `String` | Único (si se proporciona), max 20 |
| `password` | `String` | Not null, hash BCrypt |
| `role` | `Role` (enum) | Not null |
| `twoFactorCode` | `String` | Código temporal 2FA |
| `twoFactorExpiry` | `LocalDateTime` | Expiración del código 2FA |
| `createdAt` | `LocalDateTime` | Auto-generado |

### Role (Enum)
```java
CLIENTE, MOZO, COCINA, ADMIN, REPARTIDOR
```

---

## Endpoints

### 1. Registro de Cliente (RF01)

```
POST /auth/register
```

**Acceso:** Público (sin token)

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@gmail.com",
  "phone": "987654321",
  "password": "miPassword123",
  "role": "CLIENTE"
}
```

| Campo | Tipo | Obligatorio | Validación |
| :--- | :--- | :---: | :--- |
| `name` | `string` | ✅ | Max 100 chars |
| `email` | `string` | ✅ | Formato email válido |
| `phone` | `string` | ❌ | Max 20 chars, único |
| `password` | `string` | ✅ | Min 6 chars |
| `role` | `string` | ✅ | Enum: `CLIENTE`, `MOZO`, `COCINA`, `ADMIN`, `REPARTIDOR` |

**Response `201 Created`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "name": "Juan Pérez",
  "email": "juan@gmail.com",
  "role": "CLIENTE",
  "requiresTwoFactor": false,
  "message": "Registro exitoso"
}
```

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | Validación fallida (email inválido, contraseña corta, etc.) |
| `400` | `"El correo ya está registrado"` |
| `400` | `"El celular ya está registrado"` |

---

### 2. Inicio de Sesión (RF02)

```
POST /auth/login
```

**Acceso:** Público (sin token)

**Request Body:**
```json
{
  "identifier": "juan@gmail.com",
  "password": "miPassword123"
}
```

| Campo | Tipo | Obligatorio | Nota |
| :--- | :--- | :---: | :--- |
| `identifier` | `string` | ✅ | Puede ser **email** o **teléfono** |
| `password` | `string` | ✅ | — |

**Response `200 OK` — Login directo (CLIENTE):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "name": "Juan Pérez",
  "email": "juan@gmail.com",
  "role": "CLIENTE",
  "requiresTwoFactor": false,
  "message": "Login exitoso"
}
```

**Response `200 OK` — Requiere 2FA (ADMIN, MOZO, COCINA, REPARTIDOR):**
```json
{
  "token": null,
  "name": null,
  "email": "admin@sanpollo.pe",
  "role": "ADMIN",
  "requiresTwoFactor": true,
  "message": "Se envió un código de verificación a tu correo"
}
```

**Errores:**
| Código | Causa |
| :--- | :--- |
| `401` | `"Credenciales inválidas"` |
| `400` | `"Tu IP ha sido bloqueada temporalmente..."` (tras 5 intentos fallidos) |

---

### 3. Verificación 2FA (RF05 — Bonus Fase 1)

```
POST /auth/verify-2fa
```

**Acceso:** Público (sin token, pero requiere haber hecho login previamente)

**Request Body:**
```json
{
  "email": "admin@sanpollo.pe",
  "code": "482931"
}
```

**Response `200 OK`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "name": "Administrador",
  "email": "admin@sanpollo.pe",
  "role": "ADMIN",
  "requiresTwoFactor": false,
  "message": "Autenticación completada"
}
```

**Errores:**
| Código | Causa |
| :--- | :--- |
| `400` | `"Código de verificación inválido o expirado"` |
| `400` | `"Usuario no encontrado"` |

---

### 4. Validar Token (uso inter-servicio)

```
GET /auth/validate
```

**Acceso:** Requiere `Authorization: Bearer <token>`

**Response `200 OK`:**
```json
{
  "valid": true,
  "email": "juan@gmail.com",
  "role": "CLIENTE"
}
```

**Response `401 Unauthorized`:**
```json
{
  "valid": false,
  "message": "Token inválido o expirado"
}
```

---

## Seguridad

### JWT
- Algoritmo: **HS256**
- Expiración: configurable via `JWT_EXPIRATION_MS` (default: **24 horas**)
- Claims: `sub` (email), `role`, `userId`
- El mismo `JWT_SECRET` se comparte entre los 3 microservicios

### Bloqueo por IP (RF06)
- Tras **5 intentos fallidos** consecutivos desde la misma IP → bloqueo por **15 minutos**
- Configurable: `MAX_FAILED_ATTEMPTS`, `BLOCK_DURATION_MINUTES`
- Se resetean los intentos tras un login exitoso

### 2FA (RF05)
- Solo para roles: `ADMIN`, `MOZO`, `COCINA`, `REPARTIDOR`
- `CLIENTE` hace login directo (sin 2FA)
- Se envía código de 6 dígitos al correo electrónico
- Expira en 5 minutos (configurable: `TWO_FACTOR_EXPIRY_MINUTES`)

---

## Uso desde el Frontend

```typescript
// Registro
const resp = await fetch('http://localhost:8081/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Juan', email: 'juan@gmail.com',
    password: '123456', role: 'CLIENTE'
  })
});
const { token, name, email, role } = await resp.json();
// Guardar token en localStorage para peticiones futuras

// Login
const resp = await fetch('http://localhost:8081/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'juan@gmail.com', password: '123456' })
});
const data = await resp.json();
if (data.requiresTwoFactor) {
  // Mostrar pantalla de verificación 2FA
} else {
  // Guardar data.token
}

// Usar token en otros servicios
headers: { 'Authorization': `Bearer ${token}` }
```
