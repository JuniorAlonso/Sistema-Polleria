# Pruebas REST Client - Sistema Pollería (Fase 1)

Migración completa desde Thunder Client a **REST Client** (código abierto, sin límites de pago).

---

## 🚀 Requisitos

Instalar la extensión en VS Code:
- Nombre: **REST Client**
- ID: `humao.rest-client`
- Autor: Huachao Mao

---

## 📁 Archivos de Prueba

| Archivo | Descripción |
|---|---|
| [`polleria-fase1.http`](./polleria-fase1.http) | **Archivo Maestro:** Contiene todos los 47 endpoints y niveles en un solo flujo encadenado. |
| [`01-smoke-tests.http`](./01-smoke-tests.http) | Nivel 1: Smoke tests y verificación de salud de servicios. |
| [`02-happy-path-e2e.http`](./02-happy-path-e2e.http) | Nivel 2: Flujo completo E2E (Autenticación 5 roles, productos, mesas, pedidos, pagos, entrega y notificaciones). |
| [`03-security-rbac.http`](./03-security-rbac.http) | Nivel 3: Seguridad y control de acceso RBAC (validación de 401 y 403 por rol). |
| [`04-validations-edge-cases.http`](./04-validations-edge-cases.http) | Nivel 4: Validaciones y casos límite (400 y 404). |

---

## ⚡ Cómo Usar

1. Abre cualquiera de los archivos `.http` en VS Code.
2. Encima de cada petición aparecerá un botón clicable: **`Send Request`** (o presiona `Ctrl + Alt + R`).
3. En [`polleria-fase1.http`](./polleria-fase1.http), al ejecutar los logins (ej. `loginAdmin`, `loginCliente`), los tokens y los IDs (`PRODUCTO_ID`, `ORDEN_ID`, etc.) se capturan **automáticamente** y se reutilizan en las siguientes llamadas mediante:
   ```http
   @TOKEN_ADMIN = {{loginAdmin.response.body.token}}
   @ORDEN_ID = {{createOrder.response.body.id}}
   ```
