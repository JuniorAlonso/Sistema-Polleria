<#
.SYNOPSIS
    Script de configuracion y despliegue serverless para Sistema Polleria en Google Cloud Run.
.DESCRIPTION
    Despliega todos los microservicios (auth, orders, payments, feedback, finance, incident,
    facturacion-sunat y notification) usando referencias a Google Secret Manager (--set-secrets)
    y archivos YAML temporales (--env-vars-file), sin exponer contrasenas ni romper valores con
    comas o espacios en --set-env-vars.
.PARAMETER ProjectId
    ID del proyecto en Google Cloud Platform.
.PARAMETER Region
    Region de despliegue en GCP (default: us-central1).
.PARAMETER ArtifactRepo
    Repositorio en Artifact Registry.
.PARAMETER EnvFile
    Archivo de configuracion no sensible de produccion (default: .env.production).
.PARAMETER DryRun
    Si esta activo ($true), imprime los comandos saneados sin desplegar.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$ProjectId = "mitrufely",

    [Parameter(Mandatory = $false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory = $false)]
    [string]$ArtifactRepo = "polleria-repo",

    [Parameter(Mandatory = $false)]
    [string]$EnvFile = ".env.production",

    [Parameter(Mandatory = $false)]
    [switch]$DryRun = $true
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ">>> CONFIGURACION DE DESPLIEGUE GCP CLOUD RUN (SERVERLESS)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Proyecto: $ProjectId"
Write-Host "Region:   $Region"
Write-Host "Repo:     $ArtifactRepo"
Write-Host "EnvFile:  $EnvFile"
Write-Host "DryRun:   $DryRun"

if ($DryRun) {
    Write-Host "`n[MODO SIMULACION - SOLO CONFIGURACION ACTIVA]" -ForegroundColor Yellow
    Write-Host "Para desplegar en vivo, ejecuta:" -ForegroundColor Gray
    Write-Host ".\deploy-gcp-cloudrun.ps1 -ProjectId '$ProjectId' -Region '$Region' -EnvFile '.env.production' -DryRun:`$false`n" -ForegroundColor Gray
}

# 1. Habilitar APIs esenciales de GCP
$apisToEnable = @(
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com"
)

Write-Host "`n[Paso 1/5] APIs de GCP requeridas:" -ForegroundColor Cyan
foreach ($api in $apisToEnable) {
    Write-Host "  - $api"
}

# 2. Configuracion de Artifact Registry
$repoPath = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRepo"
Write-Host "`n[Paso 2/5] Repositorio de Contenedores:" -ForegroundColor Cyan
Write-Host "  URI Base: $repoPath"
Write-Host "  gcloud artifacts repositories create $ArtifactRepo --repository-format=docker --location=$Region --description='Sistema Polleria Images'" -ForegroundColor DarkGray

# 3. Secretos en Google Secret Manager (referenciados con --set-secrets, nunca en claro)
$secrets = @(
    "polleria-db-url",
    "polleria-database-url",
    "polleria-db-username",
    "polleria-db-password",
    "polleria-jwt-secret",
    "polleria-mail-password",
    "polleria-mercadopago-token",
    "polleria-mercadopago-webhook-secret",
    "polleria-internal-api-key",
    "polleria-notification-api-key",
    "polleria-minio-access-key",
    "polleria-minio-secret-key",
    "polleria-sunat-clave-sol",
    "polleria-sunat-cert-password",
    "polleria-sunat-cert-p12"
)

Write-Host "`n[Paso 3/5] Secretos requeridos en Secret Manager:" -ForegroundColor Cyan
foreach ($s in $secrets) {
    Write-Host "  - $s"
}

Write-Host "`n[Paso 4/5] Politica de Costos Serverless (Cloud Run):" -ForegroundColor Cyan
Write-Host "  - Min Instances: 0 (Scale-to-Zero)" -ForegroundColor Green
Write-Host "  - Max Instances: 2" -ForegroundColor Green
Write-Host "  - Memoria: 1Gi por contenedor (-XX:MaxRAMPercentage=75.0)" -ForegroundColor Green
Write-Host "  - notification-service restringido con --no-allow-unauthenticated" -ForegroundColor Green

# 5. Cargar unicamente configuracion no sensible desde EnvFile (nunca el .env local por defecto)
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $PSScriptRoot $EnvFile }
$envMap = @{}
if (Test-Path $resolvedEnvFile) {
    Get-Content $resolvedEnvFile | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$' } | ForEach-Object {
        $val = $Matches[2].Trim()
        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $envMap[$Matches[1]] = $val
    }
} elseif (-not $DryRun) {
    throw "No se encontro el archivo de entorno de produccion: $resolvedEnvFile. Crea uno desde .env.production.example antes de desplegar."
}

function Get-ConfigOrPlaceholder([string]$key, [string]$fallback) {
    if ($envMap.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($envMap[$key])) {
        return $envMap[$key]
    }
    return $fallback
}

$cors = Get-ConfigOrPlaceholder "CORS_ALLOWED_ORIGINS" "https://tu-frontend.vercel.app"
$mailUser = Get-ConfigOrPlaceholder "MAIL_USERNAME" "notificaciones@tu-dominio.com"
$authUrl = Get-ConfigOrPlaceholder "AUTH_SERVICE_URL" "https://auth-service-264198079598.us-central1.run.app"
$ordersUrl = Get-ConfigOrPlaceholder "ORDERS_SERVICE_URL" "https://orders-service-264198079598.us-central1.run.app"
$paymentsUrl = Get-ConfigOrPlaceholder "PAYMENTS_SERVICE_URL" "https://payments-service-264198079598.us-central1.run.app"
$financeUrl = Get-ConfigOrPlaceholder "FINANCE_SERVICE_URL" "https://finance-service-264198079598.us-central1.run.app"
$incidentUrl = Get-ConfigOrPlaceholder "INCIDENT_SERVICE_URL" "https://incident-service-264198079598.us-central1.run.app"
$notifUrl = Get-ConfigOrPlaceholder "NOTIFICATION_URL" "https://notification-service-264198079598.us-central1.run.app"
$minioEndpoint = Get-ConfigOrPlaceholder "MINIO_ENDPOINT" "minio.tu-dominio.com"
$minioPort = Get-ConfigOrPlaceholder "MINIO_PORT" "9000"
$minioUseSsl = Get-ConfigOrPlaceholder "MINIO_USE_SSL" "true"
$mpSandbox = Get-ConfigOrPlaceholder "MERCADOPAGO_SANDBOX" "false"
$sunatUrl = Get-ConfigOrPlaceholder "SUNAT_URL" "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService"
$sunatUsuarioSol = Get-ConfigOrPlaceholder "SUNAT_USUARIO_SOL" "MODDATOS"
$sunatRuc = Get-ConfigOrPlaceholder "SUNAT_RUC" "20608945123"
$sunatRazonSocial = Get-ConfigOrPlaceholder "SUNAT_RAZON_SOCIAL" "POLLERIA SAN POLLO DE ICA S.A.C."
$sunatNombreComercial = Get-ConfigOrPlaceholder "SUNAT_NOMBRE_COMERCIAL" "POLLERIA SAN POLLO DE ICA"
$sunatDireccion = Get-ConfigOrPlaceholder "SUNAT_DIRECCION" "AV. SAN MARTIN 456"
$sunatUbigeo = Get-ConfigOrPlaceholder "SUNAT_UBIGEO" "110101"
$sunatDepartamento = Get-ConfigOrPlaceholder "SUNAT_DEPARTAMENTO" "ICA"
$sunatProvincia = Get-ConfigOrPlaceholder "SUNAT_PROVINCIA" "ICA"
$sunatDistrito = Get-ConfigOrPlaceholder "SUNAT_DISTRITO" "ICA"
$sunatFirmaAlgoritmo = Get-ConfigOrPlaceholder "SUNAT_FIRMA_ALGORITMO" "SHA1"

if (-not $DryRun) {
    $aValidar = @{
        "CORS_ALLOWED_ORIGINS" = $cors
        "MAIL_USERNAME" = $mailUser
        "AUTH_SERVICE_URL" = $authUrl
        "ORDERS_SERVICE_URL" = $ordersUrl
        "PAYMENTS_SERVICE_URL" = $paymentsUrl
        "FINANCE_SERVICE_URL" = $financeUrl
        "INCIDENT_SERVICE_URL" = $incidentUrl
        "NOTIFICATION_URL" = $notifUrl
        "MINIO_ENDPOINT" = $minioEndpoint
    }
    foreach ($entry in $aValidar.GetEnumerator()) {
        if ($entry.Value -match 'xxxx|tu-|localhost|127\.0\.0\.1') {
            throw "Valor invalido para despliegue en vivo en $($entry.Key): '$($entry.Value)'. Define valores reales en $resolvedEnvFile."
        }
    }
    if ($sunatUrl -match 'e-beta\.sunat\.gob\.pe' -or $sunatUsuarioSol -eq 'MODDATOS') {
        Write-Warning "SUNAT apunta al entorno BETA (MODDATOS). Verifica que sea intencional antes de pasar a produccion tributaria."
    }
}

$serviceSpecs = @(
    @{
        Name = "auth-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
            "MAIL_USERNAME" = $mailUser
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "MAIL_PASSWORD=polleria-mail-password:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest"
        )
    },
    @{
        Name = "orders-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
            "AUTH_SERVICE_URL" = $authUrl
            "INCIDENT_SERVICE_URL" = $incidentUrl
            "NOTIFICATION_URL" = $notifUrl
            "MINIO_ENDPOINT" = $minioEndpoint
            "MINIO_PORT" = $minioPort
            "MINIO_USE_SSL" = $minioUseSsl
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest",
            "NOTIFICATION_API_KEY=polleria-notification-api-key:latest",
            "MINIO_ACCESS_KEY=polleria-minio-access-key:latest",
            "MINIO_SECRET_KEY=polleria-minio-secret-key:latest"
        )
    },
    @{
        Name = "payments-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
            "ORDERS_SERVICE_URL" = $ordersUrl
            "FINANCE_SERVICE_URL" = $financeUrl
            "NOTIFICATION_URL" = $notifUrl
            "MERCADOPAGO_SANDBOX" = $mpSandbox
            "MINIO_ENDPOINT" = $minioEndpoint
            "MINIO_PORT" = $minioPort
            "MINIO_USE_SSL" = $minioUseSsl
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest",
            "NOTIFICATION_API_KEY=polleria-notification-api-key:latest",
            "MERCADOPAGO_ACCESS_TOKEN=polleria-mercadopago-token:latest",
            "MERCADOPAGO_WEBHOOK_SECRET=polleria-mercadopago-webhook-secret:latest",
            "MINIO_ACCESS_KEY=polleria-minio-access-key:latest",
            "MINIO_SECRET_KEY=polleria-minio-secret-key:latest"
        )
    },
    @{
        Name = "feedback-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
            "ORDERS_SERVICE_URL" = $ordersUrl
            "PAYMENTS_SERVICE_URL" = $paymentsUrl
            "FINANCE_SERVICE_URL" = $financeUrl
            "MINIO_ENDPOINT" = $minioEndpoint
            "MINIO_PORT" = $minioPort
            "MINIO_USE_SSL" = $minioUseSsl
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest",
            "MINIO_ACCESS_KEY=polleria-minio-access-key:latest",
            "MINIO_SECRET_KEY=polleria-minio-secret-key:latest"
        )
    },
    @{
        Name = "finance-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
            "ORDERS_SERVICE_URL" = $ordersUrl
            "PAYMENTS_SERVICE_URL" = $paymentsUrl
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest"
        )
    },
    @{
        Name = "incident-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "CORS_ALLOWED_ORIGINS" = $cors
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest"
        )
    },
    @{
        Name = "notification-service"
        Public = $false
        Env = [ordered]@{
            "NODE_ENV" = "production"
            "TZ" = "America/Lima"
            "CORS_ALLOWED_ORIGINS" = $cors
            "ORDERS_SERVICE_URL" = $ordersUrl
            "PAYMENTS_SERVICE_URL" = $paymentsUrl
            "MINIO_ENDPOINT" = $minioEndpoint
            "MINIO_PORT" = $minioPort
            "MINIO_USE_SSL" = $minioUseSsl
        }
        Secrets = @(
            "DATABASE_URL=polleria-database-url:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "INTERNAL_API_KEY=polleria-internal-api-key:latest",
            "NOTIFICATION_API_KEY=polleria-notification-api-key:latest",
            "MINIO_ACCESS_KEY=polleria-minio-access-key:latest",
            "MINIO_SECRET_KEY=polleria-minio-secret-key:latest"
        )
    },
    @{
        Name = "facturacion-sunat-service"
        Public = $true
        Env = [ordered]@{
            "SPRING_PROFILES_ACTIVE" = "prod"
            "TZ" = "America/Lima"
            "CORS_ALLOWED_ORIGINS" = $cors
            "FINANCE_SERVICE_URL" = $financeUrl
            "ORDERS_SERVICE_URL" = $ordersUrl
            "SUNAT_URL" = $sunatUrl
            "SUNAT_USUARIO_SOL" = $sunatUsuarioSol
            "SUNAT_CERT_RUTA" = "/app/certificado/certificado.p12"
            "SUNAT_FIRMA_ALGORITMO" = $sunatFirmaAlgoritmo
            "SUNAT_RUC" = $sunatRuc
            "SUNAT_RAZON_SOCIAL" = $sunatRazonSocial
            "SUNAT_NOMBRE_COMERCIAL" = $sunatNombreComercial
            "SUNAT_DIRECCION" = $sunatDireccion
            "SUNAT_UBIGEO" = $sunatUbigeo
            "SUNAT_DEPARTAMENTO" = $sunatDepartamento
            "SUNAT_PROVINCIA" = $sunatProvincia
            "SUNAT_DISTRITO" = $sunatDistrito
        }
        Secrets = @(
            "DB_URL=polleria-db-url:latest",
            "DB_USERNAME=polleria-db-username:latest",
            "DB_PASSWORD=polleria-db-password:latest",
            "JWT_SECRET=polleria-jwt-secret:latest",
            "SUNAT_CLAVE_SOL=polleria-sunat-clave-sol:latest",
            "SUNAT_CERT_PASSWORD=polleria-sunat-cert-password:latest",
            "/app/certificado/certificado.p12=polleria-sunat-cert-p12:latest"
        )
    }
)

Write-Host "`n[Paso 5/5] Comandos de despliegue generados:" -ForegroundColor Cyan
foreach ($spec in $serviceSpecs) {
    $svc = $spec.Name
    $imgUri = "$repoPath/${svc}:latest"
    $authFlag = if ($spec.Public) { "--allow-unauthenticated" } else { "--no-allow-unauthenticated" }
    $secretStr = $spec.Secrets -join ","

    Write-Host "`n  # Despliegue de ${svc}:" -ForegroundColor Yellow
    Write-Host "  gcloud run deploy $svc --image $imgUri --region $Region --platform managed $authFlag --min-instances 0 --max-instances 2 --memory 1Gi --cpu 1 --timeout 120 --env-vars-file <$svc-env.yaml> --set-secrets `"$secretStr`""

    if (-not $DryRun) {
        Write-Host "`n  Ejecutando despliegue de $svc en Cloud Run..." -ForegroundColor Magenta
        $tmpEnvFile = [System.IO.Path]::GetTempFileName() + ".yaml"
        try {
            $yamlLines = foreach ($kv in $spec.Env.GetEnumerator()) {
                $escaped = ([string]$kv.Value).Replace('\', '\\').Replace('"', '\"')
                "{0}: `"{1}`"" -f $kv.Key, $escaped
            }
            [System.IO.File]::WriteAllLines($tmpEnvFile, $yamlLines, (New-Object System.Text.UTF8Encoding($false)))

            $deployArgs = @(
                "run", "deploy", $svc,
                "--image", $imgUri,
                "--region", $Region,
                "--platform", "managed",
                $authFlag,
                "--min-instances", "0",
                "--max-instances", "2",
                "--memory", "1Gi",
                "--cpu", "1",
                "--timeout", "120",
                "--env-vars-file", $tmpEnvFile,
                "--set-secrets", $secretStr,
                "--project", $ProjectId,
                "--quiet"
            )
            & gcloud @deployArgs
            if ($LASTEXITCODE -ne 0) {
                throw "Fallo gcloud run deploy para $svc (exit $LASTEXITCODE)"
            }
        } finally {
            if (Test-Path $tmpEnvFile) {
                Remove-Item -Force $tmpEnvFile -ErrorAction SilentlyContinue
            }
        }
    }
}

if ($DryRun) {
    Write-Host "`n[CONFIGURACION FINALIZADA SATISFACTORIAMENTE (DRY-RUN)]" -ForegroundColor Green
} else {
    Write-Host "`n[DESPLIEGUE FINALIZADO EXITOSAMENTE]" -ForegroundColor Green
}
