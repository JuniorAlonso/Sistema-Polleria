# Guía de Configuración de Despliegue Serverless
**Sistema de Pollería — Backend en Google Cloud Run & Frontend en Vercel**  
**Estrategia Económica:** Arquitectura Serverless con **Scale-to-Zero** (costo $0 mientras no haya peticiones).  
**Seguridad:** Aislamiento total de credenciales mediante Google Secret Manager y Vercel Environment Variables.

> ⚠️ **Estado real:** esta ruta es una **preparación lista para ejecutar**, no el despliegue activo. El entorno en producción del equipo corre sobre **AWS EC2 + Amazon RDS** (frontend en `http://3.237.70.97`), tal como queda referenciado por las *back-urls* por defecto de `payments-service/application.properties`. Los artefactos de GCP del repositorio (`polleria/cloudbuild.yaml`, `polleria/deploy-gcp-cloudrun.ps1`) están completos y en modo `DryRun` por defecto, pero cubren solo 3 de los 8 microservicios.
> Adicionalmente, el host de desarrollo apunta a **Neon** (`polleria/.env`, región `us-east-2`) y el stack Docker local usa su propio PostgreSQL en el contenedor `postgres`.

---

## 1. Arquitectura de Despliegue y Abaratamiento de Costos

```
  ┌────────────────────────────────────────────────────────┐
  │                 FRONTEND (Vercel)                      │
  │     SPA Angular 19 — CDN Global & SSL Automático       │
  │               (Plan Hobby: 100% Gratis)                │
  └───────────────────────────┬────────────────────────────┘
                              │ HTTPS / REST
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │             BACKEND (Google Cloud Run)                 │
  │   Arquitectura Serverless con Scale-to-Zero (min = 0)  │
  │                                                        │
  │   ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ │
  │   │ auth-service  │ │orders-service │ │payments-svc  │ │
  │   │  (min: 0)     │ │  (min: 0)     │ │  (min: 0)    │ │
  │   └───────┬───────┘ └───────┬───────┘ └──────┬───────┘ │
  └───────────┼─────────────────┼────────────────┼─────────┘
              │                 │                │
              └─────────────────┼────────────────┘
                                ▼
  ┌────────────────────────────────────────────────────────┐
  │           BASE DE DATOS (PostgreSQL Remoto)            │
  │   Supabase / Neon (Capa Gratuita) o Cloud SQL Mínimo   │
  └────────────────────────────────────────────────────────┘
```

### Principios de Abaratamiento Extremo
1. **Scale-to-Zero (`--min-instances 0`):** Cuando no hay comensales ni personal usando el sistema, Cloud Run reduce las instancias a **cero**. No pagas ni un solo centavo por servidores inactivos.
2. **CPU Throttling Activado:** Solo se factura el tiempo exacto de CPU y memoria mientras se procesa activamente una solicitud HTTP (facturación al milisegundo).
3. **Límite de Gasto (`--max-instances 2`):** Evita sorpresas o costos desmedidos limitando las réplicas máximas concurrentes.
4. **Memoria Optimizada (`512MiB`):** Los contenedores corren sobre Eclipse Temurin JRE 21 Alpine, manteniendo el consumo bajo control.

---

## 2. Semillas Automáticas en Producción (Seed Data)

El sistema ya está programado para sembrar automáticamente los datos esenciales cuando se despliegue sobre una base de datos nueva o limpia:

### 2.1. Usuarios Oficiales con Buzón Yopmail (`auth-service`)
Implementado en [`DataInitializer.java`](../polleria/auth-service/src/main/java/com/sistema/polleria/auth/config/DataInitializer.java):

| Correo | Rol | Celular | Clave | 2FA |
| :--- | :--- | :--- | :--- | :--- |
| `admin.polleria@yopmail.com` | `ADMIN` | 990000001 | `Password123!` | Obligatorio |
| `mozo.polleria@yopmail.com` | `MOZO` | 990000002 | `Password123!` | Obligatorio |
| `cocina.polleria@yopmail.com` | `COCINA` | 990000003 | `Password123!` | Obligatorio |
| `repartidor.polleria@yopmail.com` | `REPARTIDOR` | 990000004 | `Password123!` | Obligatorio |
| `cliente.polleria@yopmail.com` | `CLIENTE` | 990000005 | `Password123!` | No |

El 2FA no es una bandera almacenada por usuario: `AuthService` lo exige por rol (`ROLES_WITH_2FA = ADMIN, MOZO, COCINA, REPARTIDOR`) y devuelve `requiresTwoFactor: true` en el login parcial.

### 2.2. Mesas, Zonas y Carta Oficial (`orders-service`)
Implementado en [`DataInitializer.java`](../polleria/orders-service/src/main/java/com/sistema/polleria/orders/config/DataInitializer.java):
- **4 Zonas de salón** (tabla `zonas_salon`): `SALON_PRINCIPAL` (Salón Central, 4×5), `TERRAZA` (Terraza al Aire Libre, 8×9), `ZONA_VIP` (Zona VIP, 3×4) y `SEGUNDO_PISO` (Segundo Piso, 4×6).
- **5 Mesas iniciales** (Mesas 1 a 5, estado `LIBRE`, repartidas entre `SALON_PRINCIPAL` y `TERRAZA`).
- **10 Productos Oficiales:** 1 Pollo a la Brasa Clásico, 1/2 Pollo a la Brasa, 1/4 Pollo a la Brasa, Combo Familiar San Pollo, Anticuchos Clásicos (2 Palos), Porción de Papas Nativas Fritas, Inca Kola 1.5L, Chicha Morada Natural 1L, Torta de Chocolate de la Casa y Promoción Almuerzo Ejecutivo.

---

## 3. Configuración del Backend en GCP Cloud Run

### 3.1. Archivos Preparados
- **Plantilla de Variables:** [`polleria/.env.production.example`](../polleria/.env.production.example)
- **Pipeline Cloud Build:** [`polleria/cloudbuild.yaml`](../polleria/cloudbuild.yaml)
- **Script Automatizado:** [`polleria/deploy-gcp-cloudrun.ps1`](../polleria/deploy-gcp-cloudrun.ps1)

### 3.2. Paso a Paso para Desplegar (Cuando Decidas Ejecutarlo)

> Alcance del pipeline: `cloudbuild.yaml` y `deploy-gcp-cloudrun.ps1` construyen y despliegan **solo `auth-service`, `orders-service` y `payments-service`**. `feedback-service`, `inventory-service`, `finance-service`, `incident-service` y `notification-service` no están cubiertos todavía por estos artefactos.

#### 1. Iniciar sesión y fijar proyecto:
```bash
gcloud auth login
gcloud config set project TU_PROJECT_ID
```

#### 2. Habilitar APIs de GCP:
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

#### 3. Crear repositorio de imágenes Docker:
```bash
gcloud artifacts repositories create polleria-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Sistema Polleria Microservicios"
```

#### 4. Guardar secretos en Google Secret Manager:
```bash
# Guardar contraseña de BD
echo -n "TU_DB_PASSWORD" | gcloud secrets create polleria-db-password --data-file=-

# Guardar clave JWT (mínimo 32 caracteres)
echo -n "TU_JWT_SECRET_SUPER_SEGURO_2026" | gcloud secrets create polleria-jwt-secret --data-file=-
```

#### 5. Construir y Desplegar microservicios:
```bash
# Desde la carpeta polleria/
gcloud builds submit --config cloudbuild.yaml .

# Desplegar con Scale-to-Zero:
gcloud run deploy auth-service \
  --image us-central1-docker.pkg.dev/TU_PROJECT_ID/polleria-repo/auth-service:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "DB_URL=jdbc:postgresql://<HOST>:5432/polleria,DB_USERNAME=postgres" \
  --set-secrets "DB_PASSWORD=polleria-db-password:latest,JWT_SECRET=polleria-jwt-secret:latest"
```
*(Repetir para `orders-service` y `payments-service` según el script `deploy-gcp-cloudrun.ps1`).*

### 3.3. Almacenamiento de los comprobantes de Yape (MinIO, T6b/S7)

El flujo de pago por Yape hecho por WhatsApp necesita un **bucket de objetos**: el
`notification-service` sube la imagen del comprobante y `payments-service` guarda solo la clave
(`comprobanteClave`). En local ese bucket es el servicio **MinIO** del compose
(`polleria/docker-compose.local.yml`, API `:9000`, consola `:9001`, volumen `polleria_local_minio_data`).

> ⚠️ **El despliegue todavía no provisiona el bucket.** `notification-service` no está en
> `cloudbuild.yaml` ni en `deploy-gcp-cloudrun.ps1` (ver alcance en 3.2), así que esta ruta no
despliega el servicio que sube el comprobante. Cuando se despliegue, el contenedor necesita:
>
> - `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`,
>   `MINIO_BUCKET` — apuntando a un bucket S3-compatible real (Cloud Storage con S3 interop o MinIO en
>   una VM). Las credenciales van en **Secret Manager**, nunca en el repositorio.
> - `PAYMENTS_SERVICE_URL` y `INTERNAL_API_KEY` — para registrar la evidencia con `X-Internal-Key`
>   en `payments-service` (`POST /pagos/comprobante`).
>
> En Docker Compose, el endpoint de MinIO es `minio` (el nombre del servicio), no `localhost`, porque
> cada contenedor tiene su propio loopback; `localhost:9000` solo aplica cuando el servicio se ejecuta
> desde el host. Si no se provisiona el bucket, el bot avisa al cliente que no pudo guardar el
> comprobante en vez de inventar un éxito.

---

## 4. Configuración del Frontend en Vercel

### 4.1. Archivos Preparados
- **Configuración Vercel:** [`frontEnd/vercel.json`](../frontEnd/vercel.json)
  - Salida `dist/frontend-app/browser` (coincide con `outputPath: dist/frontend-app` de `angular.json`) y `buildCommand: npm run build`.
  - **Reescrituras hacia Cloud Run ya incluidas** para `auth`, `ordenes`, `productos`, `mesas` y `pagos` (bajo `/api/...` y también en la raíz), más el fallback SPA `/(.*)` ➔ `/index.html`.
  - ⚠️ **Faltan las reescrituras de feedback, inventario, finanzas e incidentes.** El frontend ya usa la misma convención que los tres servicios que sí funcionan (`/api` + ruta del módulo), así que las rutas reales a reescribir son `/api/feedback/:path*`, `/api/inventario/:path*`, `/api/finanzas/:path*` y `/api/incidentes/:path*`. No se añadieron porque **se desconoce su destino**: ni `cloudbuild.yaml` ni `deploy-gcp-cloudrun.ps1` despliegan esos 4 servicios (cubren solo `auth-service`, `orders-service` y `payments-service`), así que no hay URL de Cloud Run que declarar. Hasta tenerlas, esas pestañas del panel no resuelven en el dominio de Vercel.
  - Cabeceras HTTP de seguridad (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Referrer-Policy`) y caché inmutable para `/assets/**`.
- **Plantilla de Variables:** [`frontEnd/.env.example`](../frontEnd/.env.example)

### 4.2. Paso a Paso para Desplegar en Vercel

1. **Vía Git (Recomendado):**
   - Importa tu repositorio en el panel de [Vercel](https://vercel.com/new).
   - En **Root Directory**, selecciona `frontEnd`.
   - Vercel detectará automáticamente **Angular**.
2. **Sobre las variables de entorno (`NG_APP_*`):**
   - El código Angular **no lee variables `NG_APP_*`**: `environment.ts` y `environment.development.ts` son archivos estáticos, y la compilación de producción define URLs relativas (`authApiUrl: '/api'`, `ordersApiUrl: '/api'`, `wsUrl: '/ws-polleria'`).
   - Por lo tanto, la configuración real de las URLs de backend en Vercel son las **reescrituras de `vercel.json`**, no las variables de entorno. `frontEnd/.env.example` documenta una convención que quedó sin cablear y sirve solo como referencia histórica.
3. **CORS en Backend:**
   - Una vez que Vercel te dé tu dominio (ej: `https://sistema-polleria.vercel.app`), actualiza la variable `CORS_ALLOWED_ORIGINS` en Cloud Run para permitir que tu frontend consuma los servicios. El valor por defecto del repositorio es `http://localhost:4200` en `auth`, `orders` y `payments`, y `http://localhost:4200,http://localhost:80,http://localhost` en `feedback`, `finance`, `inventory` e `incident`.
   - Además de esa lista, los 7 servicios Java aceptan **cualquier puerto de loopback** (`localhost`, `127.0.0.1` y `[::1]`, en cualquier puerto), porque en local `ng serve` arranca en otro puerto cuando 4200 está ocupado y la app puede abrirse por `127.0.0.1`. Ese permiso **no habilita orígenes externos**: un origen ajeno sigue rechazado con `403` y cada servicio tiene un `OrigenesCorsLoopbackTest` que lo fija.

---

## 5. Resumen de Seguridad: Protección contra Fugas

| Archivo | Estado de Seguridad | Propósito |
| :--- | :---: | :--- |
| `polleria/.env` | 🔒 **Ignorado en `.gitignore`** | Credenciales de desarrollo local (host `Neon`, `us-east-2`). |
| `polleria/.env.production.example` | ✅ **Sanitizado / Plantilla** | Documenta las variables requeridas sin exponer valores reales. |
| `frontEnd/.env.example` | ✅ **Sanitizado / Plantilla** | Guía histórica de configuración para Vercel (convención `NG_APP_*`, sin cablear en el código). |
| `frontEnd/vercel.json` | ✅ **Limpio de Secretos** | Reescrituras a Cloud Run, routing SPA y headers defensivos. |
| `polleria/deploy-gcp-cloudrun.ps1` | ✅ **Modo DryRun por Defecto** | Previene ejecuciones accidentales y usa Secret Manager. |

### Deuda de seguridad conocida

- ✅ **Cerrado:** el *access token* de Mercado Pago ya no está en el bundle. Se eliminó el TIER 2 de `PaymentService`, la entrada `mercadoPago.accessToken` de `environment.ts` y `environment.development.ts`, y la regla `/mp-api` de `proxy.conf.json`. El checkout conserva el modo resiliente simulado cuando la pasarela no responde. **Pendiente del humano:** rotar en el panel de Mercado Pago el token que sí estuvo publicado (`APP_USR-2733300582350003-...` y `APP_USR-8230025375459217-...`), porque sigue siendo válido hasta que se revoque.
- `mercadopago.public-key` en `payments-service/application.properties` tiene un valor real como *default*, mientras que `mercadopago.access-token` sí usa default vacío. La clave pública es segura en el cliente, pero conviene dejarla sin valor por defecto por coherencia.
- ✅ **Cerrado:** `jwt.secret` ya no tiene valor por defecto en ninguno de los 7 servicios (`jwt.secret=${JWT_SECRET}`). Si `JWT_SECRET` falta en el despliegue, el servicio **no arranca**: es preferible un arranque fallido a firmar tokens con una clave que está en el repositorio. **Consecuencia operativa:** hay que definir `JWT_SECRET` y `INTERNAL_API_KEY` en cada unidad de despliegue (systemd/EC2, Cloud Run o Docker) antes de actualizar, o los servicios no levantarán.
- `mercadopago.public-key` en `payments-service/application.properties` tiene un valor real como *default*, mientras que `mercadopago.access-token` sí usa default vacío. La clave pública es segura en el cliente, pero conviene dejarla sin valor por defecto por coherencia.
