# Facturación electrónica SUNAT — facturacion-sunat-service

Guía para entender, probar y explicar el microservicio de facturación electrónica de El San Pollo.

---

## 1. ¿Qué problema resuelve?

`finance-service` emite boletas y facturas internas con su número (`B001-000015`), cliente e IGV,
y las guarda en base de datos. Para SUNAT ese comprobante solo tiene validez tributaria cuando:

1. Existe como **XML** en el formato oficial (**UBL 2.1**).
2. Está **firmado digitalmente** con el certificado `.p12` de la empresa.
3. Fue **enviado a SUNAT** y SUNAT respondió con un **CDR** (Constancia de Recepción) aceptado.

`facturacion-sunat-service` implementa esta modalidad (**SEE – Del Contribuyente**) conectándose
directo a SUNAT sin intermediarios (OSE/PSE) y manteniendo intacto el flujo de caja/mozo existente.

---

## 2. Arquitectura y flujo de concurrencia

```
 Angular (Caja / Admin)
     │ 1. Cobra y emite comprobante         2. Botón manual "Enviar a SUNAT"
     ▼                                              │
 finance-service :8087 ◄── lee comprobante ── facturacion-sunat-service :8089 ── SOAP ──► SUNAT
 orders-service  :8082 ◄── lee productos   ──┘        │                                      │
                                                      └── guarda XML + CDR + estado ◄── CDR ─┘
                                                          (tabla envios_sunat)
```

- **Responsabilidades separadas:** `facturacion-sunat-service` NO modifica `finance-service`,
  `orders-service`, `payments-service` ni el flujo del mozo; solo consulta `finance` y `orders`
  reenviando el token JWT del `CAJERO` o `ADMIN`.
- **Dos transacciones cortas:** en `FacturacionService`, la Tx1 adquiere `pg_advisory_xact_lock`,
  valida idempotencia, firma el XML y marca el registro como `ENVIANDO` (liberando la conexión de
  PostgreSQL antes de la llamada HTTP SOAP). La llamada SOAP a SUNAT se ejecuta fuera de transacción
  y la Tx2 guarda el CDR y estado final (`ACEPTADO`, `OBSERVADO`, `RECHAZADO` o `ERROR`). Si un
  `ENVIANDO` queda colgado más de 2 minutos por caída del contenedor, puede reintentarse.

---

## 3. Endpoints (solo ADMIN y CAJERO)

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/facturacion/orden/{ordenId}/enviar` | Genera, firma y envía a SUNAT |
| GET | `/facturacion/orden/{ordenId}` | Estado del envío |
| GET | `/facturacion?estado=` | Últimos envíos (hasta 500, con filtro opcional por estado) |
| GET | `/facturacion/orden/{ordenId}/xml` | Descarga el XML firmado |
| GET | `/facturacion/orden/{ordenId}/cdr` | Descarga el CDR (`.zip`) |
| GET | `/facturacion/orden/{ordenId}/ticket` | Ticket HTML 80 mm con QR (solo `ACEPTADO` u `OBSERVADO`) |

---

## 4. Cómo probarlo en local (SUNAT Beta)

1. **Generar certificado de prueba** en `polleria/facturacion-sunat-service/certificado/`:

```powershell
keytool -genkeypair -alias polleria -keyalg RSA -keysize 2048 -validity 3650 `
  -dname "CN=POLLERIA SAN POLLO DE ICA, O=POLLERIA SAN POLLO DE ICA S.A.C., C=PE" `
  -storetype PKCS12 -keystore certificado/certificado-beta.p12 -storepass TU_CLAVE
```

2. **Configurar variables:** copia `facturacion-sunat-service/.env.example` a
   `facturacion-sunat-service/.env` y define `SUNAT_CERT_PASSWORD=TU_CLAVE` (RUC por defecto:
   `20608945123`, usuario SOL beta: `MODDATOS` / `moddatos`).
   En **Cloud Run**, el certificado se monta desde Google Secret Manager como archivo secreto
   (`/app/certificado/certificado.p12`) o mediante `SUNAT_CERT_BASE64`.
3. **Levantar:** desde `polleria/`, con `postgres`, `auth`, `orders` y `finance` corriendo:

```powershell
.\mvnw.cmd -pl facturacion-sunat-service spring-boot:run
```

4. **Pruebas unitarias** (sin internet ni base de datos):

```powershell
.\mvnw.cmd -pl facturacion-sunat-service test
```

---

## 5. Integración Frontend (`frontEnd/`)

- `frontEnd/proxy.conf.json` y `frontEnd/vercel.json`: enrutan `/api/facturacion` y `/facturacion`.
- `frontEnd/src/app/core/api/facturacion-sunat-api.service.ts` y `facturacion-sunat.service.ts`:
  cliente HTTP y estado reactivo con Signals (`abrirTicketSunat`, `descargarXml`, `descargarCdr`).
- **Caja:** bloque SUNAT bajo demanda en `cajero-ticket-modal.component.ts` y columna SUNAT en
  `cajero-historial-tab.component.ts` (conectado desde `cajero-dashboard.component.ts`).
- **Admin:** pestaña **Facturación SUNAT** en `admin-finanzas.page.ts` (`sunat-billing-panel.component.ts`).
