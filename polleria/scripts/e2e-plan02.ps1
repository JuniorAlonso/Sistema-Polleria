<#
.SYNOPSIS
  Control de infraestructura aislada E2E (B2.7.1) para Plan 02 (Recojo y Mostrador).
  Soporta unicamente: validate, up, status, down.
  No ejecuta escenarios mutacionales ni elimina bases de datos o volumenes.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('validate', 'up', 'status', 'down')]
    [string]$Action = 'validate'
)

$ErrorActionPreference = 'Stop'

$PolleriaDir = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $PolleriaDir 'docker-compose.e2e.yml'
$EnvFile     = Join-Path $PolleriaDir '.env.e2e'
$ProjectName = 'polleria-e2e'
$ExpectedDb  = 'polleria_e2e'
$ExternalNet = 'polleria_local_network'

function Read-E2EEnv {
    if (-not (Test-Path $EnvFile)) {
        throw "No se encontro $EnvFile"
    }
    $map = @{}
    foreach ($line in Get-Content $EnvFile) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -gt 0) {
            $k = $trimmed.Substring(0, $idx).Trim()
            $v = $trimmed.Substring($idx + 1).Trim()
            $map[$k] = $v
        }
    }
    return $map
}

function Assert-E2EGuards {
    if (-not (Test-Path $ComposeFile)) {
        throw "No se encontro $ComposeFile"
    }
    $envMap = Read-E2EEnv

    if ($envMap['E2E_POSTGRES_DB'] -ne $ExpectedDb) {
        throw "GUARD ABORT: E2E_POSTGRES_DB debe ser exactamente '$ExpectedDb' (actual: '$($envMap['E2E_POSTGRES_DB'])')"
    }
    if ($envMap['E2E_PAYMENTS_MOCK_GATEWAYS_ENABLED'] -ne 'true') {
        throw "GUARD ABORT: E2E_PAYMENTS_MOCK_GATEWAYS_ENABLED debe ser 'true'"
    }
    if ($envMap['E2E_PAYMENTS_YAPE_OTP_MOCK_ENABLED'] -ne 'true') {
        throw "GUARD ABORT: E2E_PAYMENTS_YAPE_OTP_MOCK_ENABLED debe ser 'true'"
    }
    if (-not [string]::IsNullOrWhiteSpace($envMap['E2E_MERCADOPAGO_ACCESS_TOKEN'])) {
        throw "GUARD ABORT: E2E_MERCADOPAGO_ACCESS_TOKEN debe estar vacio en E2E"
    }
    if (-not [string]::IsNullOrWhiteSpace($envMap['E2E_MERCADOPAGO_WEBHOOK_SECRET'])) {
        throw "GUARD ABORT: E2E_MERCADOPAGO_WEBHOOK_SECRET debe estar vacio en E2E"
    }
    if (-not [string]::IsNullOrWhiteSpace($envMap['E2E_MAIL_USERNAME']) -or -not [string]::IsNullOrWhiteSpace($envMap['E2E_MAIL_PASSWORD'])) {
        throw "GUARD ABORT: E2E_MAIL_USERNAME y E2E_MAIL_PASSWORD deben estar vacios en E2E"
    }
    if ($envMap['E2E_NOTIFICATION_URL'] -ne 'http://127.0.0.1:1') {
        throw "GUARD ABORT: E2E_NOTIFICATION_URL debe apuntar a http://127.0.0.1:1"
    }

    $composeRaw = Get-Content $ComposeFile -Raw
    if ($composeRaw -notmatch "(?m)^name:\s*$ProjectName\s*$") {
        throw "GUARD ABORT: docker-compose.e2e.yml debe declarar 'name: $ProjectName'"
    }
    if ($composeRaw -match '(?m)^\s*container_name:') {
        throw "GUARD ABORT: docker-compose.e2e.yml no debe definir 'container_name'"
    }
    if ($composeRaw -match 'http://(auth-service|orders-service|payments-service|finance-service|notification-service)\b') {
        throw "GUARD ABORT: docker-compose.e2e.yml referencia un servicio de desarrollo en lugar de e2e-*"
    }
    if ($composeRaw -match 'polleria_test|5432/polleria\b') {
        throw "GUARD ABORT: docker-compose.e2e.yml contiene una referencia prohibida a polleria o polleria_test"
    }

    $pgHealth = docker inspect polleria-postgres --format '{{.State.Health.Status}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or $pgHealth.Trim() -ne 'healthy') {
        throw "GUARD ABORT: polleria-postgres no esta healthy (estado: '$pgHealth')"
    }

    $minioHealth = docker inspect polleria-minio --format '{{.State.Health.Status}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or $minioHealth.Trim() -ne 'healthy') {
        throw "GUARD ABORT: polleria-minio no esta healthy (estado: '$minioHealth')"
    }

    docker network inspect $ExternalNet *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "GUARD ABORT: La red externa '$ExternalNet' no existe"
    }

    $dbExists = docker exec polleria-postgres psql -U $envMap['POSTGRES_USER'] -tAc "SELECT 1 FROM pg_database WHERE datname = '$ExpectedDb'" 2>$null
    if ($LASTEXITCODE -ne 0 -or $dbExists.Trim() -ne '1') {
        throw "GUARD ABORT: La base de datos '$ExpectedDb' no existe en polleria-postgres"
    }

    $requiredImages = @(
        'polleria-auth-service:latest',
        'polleria-orders-service:latest',
        'polleria-payments-service:latest',
        'polleria-finance-service:latest'
    )
    foreach ($img in $requiredImages) {
        docker image inspect $img *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "GUARD ABORT: Falta la imagen requerida '$img'"
        }
    }

    # Validar sintaxis del compose
    docker compose -p $ProjectName -f $ComposeFile --env-file $EnvFile config -q
    if ($LASTEXITCODE -ne 0) {
        throw "GUARD ABORT: Error de sintaxis en $ComposeFile"
    }
}

function Show-Status {
    $envMap = Read-E2EEnv
    Write-Host "=== Estado proyecto $ProjectName ===" -ForegroundColor Cyan
    docker compose -p $ProjectName -f $ComposeFile --env-file $EnvFile ps

    $tableCount = docker exec polleria-postgres psql -U $envMap['POSTGRES_USER'] -d $ExpectedDb -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>$null
    Write-Host "Tablas en ${ExpectedDb}: $($tableCount.Trim())"

    Write-Host "=== Contenedores originales (polleria) ===" -ForegroundColor Cyan
    docker ps --filter "name=^polleria-" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
}

switch ($Action) {
    'validate' {
        Assert-E2EGuards
        Write-Host "PASS: Guardas de aislamiento, red, BD '$ExpectedDb', imagenes y sintaxis verificadas." -ForegroundColor Green
    }
    'up' {
        Assert-E2EGuards
        Write-Host "Levantando stack aislado '$ProjectName' (--no-build)..." -ForegroundColor Cyan
        docker compose -p $ProjectName -f $ComposeFile --env-file $EnvFile up -d --no-build
        if ($LASTEXITCODE -ne 0) {
            throw "Error al iniciar el proyecto $ProjectName"
        }

        $services = @('e2e-auth', 'e2e-orders', 'e2e-payments', 'e2e-finance')
        $deadline = (Get-Date).AddSeconds(120)
        do {
            $allHealthy = $true
            foreach ($svc in $services) {
                $cid = docker compose -p $ProjectName -f $ComposeFile --env-file $EnvFile ps -q $svc
                if (-not $cid) { $allHealthy = $false; break }
                $health = docker inspect $cid --format '{{.State.Health.Status}}' 2>$null
                if ($health.Trim() -ne 'healthy') {
                    $allHealthy = $false
                }
            }
            if (-not $allHealthy) { Start-Sleep -Seconds 3 }
        } while (-not $allHealthy -and (Get-Date) -lt $deadline)

        Show-Status
        if (-not $allHealthy) {
            throw "Timeout esperando estado healthy en los servicios de $ProjectName"
        }
        Write-Host "PASS: Stack '$ProjectName' operativo y healthy." -ForegroundColor Green
    }
    'status' {
        Assert-E2EGuards
        Show-Status
    }
    'down' {
        Assert-E2EGuards
        Write-Host "Deteniendo unicamente proyecto '$ProjectName' (sin -v ni borrado de BD)..." -ForegroundColor Yellow
        docker compose -p $ProjectName -f $ComposeFile --env-file $EnvFile down
        if ($LASTEXITCODE -ne 0) {
            throw "Error al detener el proyecto $ProjectName"
        }
        Write-Host "PASS: Contenedores de '$ProjectName' detenidos de forma segura." -ForegroundColor Green
    }
}
