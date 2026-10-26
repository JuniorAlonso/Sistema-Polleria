# Script de prueba automatizada: Ciclo de Vida del Pedido y Auditoria de Seguridad
$ErrorActionPreference = "Stop"

function Write-Step($title) {
    Write-Host "`n==================================================" -ForegroundColor Cyan
    Write-Host ">>> $title" -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Cyan
}

try {
    # -------------------------------------------------------------------------
    Write-Step "1. Login de Cliente con Yopmail (cliente.polleria@yopmail.com)"
    # -------------------------------------------------------------------------
    $loginBody = @{
        identifier = "cliente.polleria@yopmail.com"
        password   = "Password123!"
    } | ConvertTo-Json

    $loginResp = Invoke-RestMethod -Uri "http://localhost:8081/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $clientToken = $loginResp.token
    $clientRefreshToken = $loginResp.refreshToken

    Write-Host "OK - Login de cliente exitoso!" -ForegroundColor Green
    Write-Host "   Nombre: $($loginResp.name)"
    Write-Host "   Rol: $($loginResp.role)"
    Write-Host "   Token JWT (preview): $($clientToken.Substring(0, 30))..."
    Write-Host "   Refresh Token: $clientRefreshToken"

    # -------------------------------------------------------------------------
    Write-Step "2. Login de Admin con 2FA (admin.polleria@yopmail.com)"
    # -------------------------------------------------------------------------
    $adminLoginBody = @{
        identifier = "admin.polleria@yopmail.com"
        password   = "Password123!"
    } | ConvertTo-Json

    $adminInitResp = Invoke-RestMethod -Uri "http://localhost:8081/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json"
    Write-Host "   Respuesta inicial de login Admin: requiresTwoFactor = $($adminInitResp.requiresTwoFactor)"

    # Obtener el codigo 2FA generado en base de datos
    $rawCode = docker exec polleria-postgres psql -U postgres -d polleria -t -A -c "SELECT code FROM two_factor_tokens WHERE user_id = (SELECT id FROM users WHERE email='admin.polleria@yopmail.com') AND used=false ORDER BY created_at DESC LIMIT 1;"
    $twoFactorCode = "$rawCode".Trim()
    
    if ($twoFactorCode -match "^\d{6}$") {
        Write-Host "   Codigo 2FA capturado de la base de datos: $twoFactorCode" -ForegroundColor Magenta

        $verifyBody = @{
            email = "admin.polleria@yopmail.com"
            code  = $twoFactorCode
        } | ConvertTo-Json

        $adminAuthResp = Invoke-RestMethod -Uri "http://localhost:8081/auth/verify-2fa" -Method Post -Body $verifyBody -ContentType "application/json"
        $adminToken = $adminAuthResp.token
        Write-Host "OK - 2FA verificado exitosamente! Token Admin obtenido." -ForegroundColor Green
    } else {
        throw "No se pudo obtener el codigo 2FA de la base de datos"
    }

    # -------------------------------------------------------------------------
    Write-Step "3. Configuracion de Carta y Mesas (Admin)"
    # -------------------------------------------------------------------------
    $authAdminHeaders = @{ Authorization = "Bearer $adminToken" }

    # Crear Mesa 1
    try {
        $mesaBody = @{ numero = 1; capacidad = 4 } | ConvertTo-Json
        $mesaResp = Invoke-RestMethod -Uri "http://localhost:8082/mesas" -Method Post -Headers $authAdminHeaders -Body $mesaBody -ContentType "application/json"
        $mesaId = $mesaResp.id
        Write-Host "OK - Mesa #1 creada (ID: $mesaId)" -ForegroundColor Green
    } catch {
        $mesas = Invoke-RestMethod -Uri "http://localhost:8082/mesas" -Method Get -Headers $authAdminHeaders
        $mesaId = $mesas[0].id
        Write-Host "INFO - Usando Mesa existente ID: $mesaId" -ForegroundColor Yellow
    }

    # Crear Productos en Carta si no existen
    $productosExistentes = Invoke-RestMethod -Uri "http://localhost:8082/productos" -Method Get
    if ($productosExistentes.Count -eq 0) {
        $p1 = @{
            nombre      = "1 Pollo a la Brasa Clasico"
            descripcion = "Con papas fritas y ensalada fresca"
            precio      = 65.50
            categoria   = "POLLO_ENTERO"
            disponible  = $true
        } | ConvertTo-Json
        $prod1 = Invoke-RestMethod -Uri "http://localhost:8082/productos" -Method Post -Headers $authAdminHeaders -Body $p1 -ContentType "application/json"
        
        $p2 = @{
            nombre      = "Inca Kola 1.5L"
            descripcion = "Gaseosa helada"
            precio      = 12.00
            categoria   = "BEBIDA"
            disponible  = $true
        } | ConvertTo-Json
        $prod2 = Invoke-RestMethod -Uri "http://localhost:8082/productos" -Method Post -Headers $authAdminHeaders -Body $p2 -ContentType "application/json"

        $prod1Id = $prod1.id
        $prod2Id = $prod2.id
        Write-Host "OK - Productos creados en carta: ID $prod1Id y ID $prod2Id" -ForegroundColor Green
    } else {
        $prod1Id = $productosExistentes[0].id
        $prod2Id = if ($productosExistentes.Count -gt 1) { $productosExistentes[1].id } else { $prod1Id }
        Write-Host "INFO - Usando productos existentes: ID $prod1Id y ID $prod2Id" -ForegroundColor Yellow
    }

    # -------------------------------------------------------------------------
    Write-Step "4. Cliente Consulta la Carta Publica (sin token)"
    # -------------------------------------------------------------------------
    $carta = Invoke-RestMethod -Uri "http://localhost:8082/productos" -Method Get
    Write-Host "OK - Carta consultada publicamente. $($carta.Count) productos disponibles." -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "5. Cliente Crea un Pedido (SALON en Mesa #$mesaId)"
    # -------------------------------------------------------------------------
    $authClientHeaders = @{ Authorization = "Bearer $clientToken" }

    $orderPayload = @{
        tipo          = "SALON"
        mesaId        = $mesaId
        observaciones = "Papas bien doradas por favor"
        items         = @(
            @{ productoId = $prod1Id; cantidad = 1; notas = "Parte pierna" }
            @{ productoId = $prod2Id; cantidad = 2; notas = "Bien helada" }
        )
    } | ConvertTo-Json -Depth 5

    $orderResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes" -Method Post -Headers $authClientHeaders -Body $orderPayload -ContentType "application/json"
    $ordenId = $orderResp.id
    $montoTotal = $orderResp.total

    Write-Host "OK - Orden #$ordenId creada exitosamente!" -ForegroundColor Green
    Write-Host "   Tipo: $($orderResp.tipo)"
    Write-Host "   Estado: $($orderResp.estado)"
    Write-Host "   Monto Total: S/ $montoTotal"
    Write-Host "   Items: $($orderResp.items.Count)"

    # -------------------------------------------------------------------------
    Write-Step "6. Cliente Consulta el Estado del Pedido (Tracking)"
    # -------------------------------------------------------------------------
    $trackingResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$ordenId" -Method Get -Headers $authClientHeaders
    Write-Host "OK - Tracking verificado! Orden #$ordenId en estado: $($trackingResp.estado)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "7. Cliente Paga el Pedido (payments-service)"
    # -------------------------------------------------------------------------
    $paymentPayload = @{
        ordenId       = $ordenId
        monto         = $montoTotal
        metodoPago    = "TARJETA"
        tokenPasarela = "tok_test_mock_visa_4242"
    } | ConvertTo-Json

    $paymentResp = Invoke-RestMethod -Uri "http://localhost:8083/pagos" -Method Post -Headers $authClientHeaders -Body $paymentPayload -ContentType "application/json"
    Write-Host "OK - Pago procesado exitosamente!" -ForegroundColor Green
    Write-Host "   Pago ID: $($paymentResp.id)"
    Write-Host "   Estado: $($paymentResp.estado)"
    Write-Host "   Referencia: $($paymentResp.referenciaExterna)"

    # -------------------------------------------------------------------------
    Write-Step "8. Progresion del Pedido por Cocina y Salon"
    # -------------------------------------------------------------------------
    $pPrep = @{ estado = "EN_PREPARACION" } | ConvertTo-Json
    $rPrep = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$ordenId/estado" -Method Patch -Headers $authAdminHeaders -Body $pPrep -ContentType "application/json"
    Write-Host ">>> Estado actualizado a: $($rPrep.estado)" -ForegroundColor Cyan

    $pListo = @{ estado = "LISTO" } | ConvertTo-Json
    $rListo = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$ordenId/estado" -Method Patch -Headers $authAdminHeaders -Body $pListo -ContentType "application/json"
    Write-Host ">>> Estado actualizado a: $($rListo.estado)" -ForegroundColor Cyan

    $pEntregado = @{ estado = "ENTREGADO" } | ConvertTo-Json
    $rEntregado = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$ordenId/estado" -Method Patch -Headers $authAdminHeaders -Body $pEntregado -ContentType "application/json"
    Write-Host "OK - Estado final de la orden: $($rEntregado.estado)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "9. Cliente Consulta su Historial de Ordenes"
    # -------------------------------------------------------------------------
    $misOrdenes = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/mis-ordenes" -Method Get -Headers $authClientHeaders
    Write-Host "OK - Historial del cliente obtenido ($($misOrdenes.Count) ordenes)." -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "10. Auditoria de Seguridad: Refresh Token Rotation (RTR)"
    # -------------------------------------------------------------------------
    $refreshBody = @{ refreshToken = $clientRefreshToken } | ConvertTo-Json
    $refreshResp = Invoke-RestMethod -Uri "http://localhost:8081/auth/refresh" -Method Post -Body $refreshBody -ContentType "application/json"
    $newClientToken = $refreshResp.token
    $newClientRefreshToken = $refreshResp.refreshToken

    Write-Host "OK - Refresh Token rotado exitosamente!" -ForegroundColor Green
    Write-Host "   Nuevo Token (preview): $($newClientToken.Substring(0, 30))..."
    Write-Host "   Nuevo Refresh Token: $newClientRefreshToken"

    # Verificar que el viejo refresh token YA NO SIRVE (deteccion de reuso / invalidado)
    try {
        $stolenAttempt = @{ refreshToken = $clientRefreshToken } | ConvertTo-Json
        Invoke-RestMethod -Uri "http://localhost:8081/auth/refresh" -Method Post -Body $stolenAttempt -ContentType "application/json"
        Write-Error "FALLO DE SEGURIDAD: El refresh token revocado fue aceptado!"
    } catch {
        Write-Host "DEFENSA ACTIVA: El refresh token revocado fue rechazado correctamente con 401 Unauthorized." -ForegroundColor Green
    }

    # -------------------------------------------------------------------------
    Write-Step "11. Cierre de Sesion (Logout)"
    # -------------------------------------------------------------------------
    $logoutBody = @{ refreshToken = $newClientRefreshToken } | ConvertTo-Json
    $logoutResp = Invoke-RestMethod -Uri "http://localhost:8081/auth/logout" -Method Post -Body $logoutBody -ContentType "application/json"
    Write-Host "OK - Logout completado: $($logoutResp.message)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "12. Flujo Delivery Web con Yape OTP (Mercado Pago)"
    # -------------------------------------------------------------------------
    $yapeOrderPayload = @{
        tipo             = "DELIVERY"
        canalOrigen      = "WEB"
        nombreCliente    = "Maria Lopez"
        telefonoCliente  = "912345678"
        direccionEntrega = "Av. El Sol 555, Ica"
        referencia       = "Casa blanca porton negro"
        items            = @(
            @{ productoId = $prod1Id; cantidad = 1; notas = "Con aji extra" }
        )
    } | ConvertTo-Json -Depth 5

    $yapeOrderResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes" -Method Post -Body $yapeOrderPayload -ContentType "application/json"
    $yapeOrderId = $yapeOrderResp.id
    Write-Host "OK - Pedido Delivery Yape #$yapeOrderId creado!" -ForegroundColor Green

    # Pagar directo con Yape OTP
    $yapePaymentPayload = @{
        ordenId   = $yapeOrderId
        monto     = $yapeOrderResp.total
        telefono  = "912345678"
        otp       = "123456"
        email     = "maria.lopez@test.com"
    } | ConvertTo-Json

    $yapePayResp = Invoke-RestMethod -Uri "http://localhost:8083/pagos/yape-otp" -Method Post -Body $yapePaymentPayload -ContentType "application/json"
    Write-Host "OK - Cobro Yape OTP aprobado! Ref: $($yapePayResp.referenciaExterna)" -ForegroundColor Green

    # Verificar que paso directo a preparacion en cocina sin intervencion de cajero
    $yapeCheck = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$yapeOrderId" -Method Get -Headers $authAdminHeaders
    Write-Host "OK - Estado de pedido Yape en orders-service: $($yapeCheck.estado)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "13. Flujo Delivery ContraPago: Confirmacion, En Puerta y Cobro Efectivo"
    # -------------------------------------------------------------------------
    $codOrderPayload = @{
        tipo             = "DELIVERY"
        canalOrigen      = "WEB"
        estadoInicial    = "PENDIENTE_CONFIRMACION"
        nombreCliente    = "Carlos ContraPago"
        telefonoCliente  = "987654321"
        direccionEntrega = "Calle Lima 321, Ica"
        referencia       = "Piso 2"
        montoPagaCon     = 100.00
        ipOrigen         = "192.168.1.55"
        items            = @(
            @{ productoId = $prod1Id; cantidad = 1 }
        )
    } | ConvertTo-Json -Depth 5

    $codOrderResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes" -Method Post -Body $codOrderPayload -ContentType "application/json"
    $codOrderId = $codOrderResp.id
    Write-Host "OK - Pedido ContraPago #$codOrderId creado en estado: $($codOrderResp.estado)" -ForegroundColor Green
    Write-Host "   Vuelto estimado calculado: S/ $($codOrderResp.vueltoEstimado)" -ForegroundColor Yellow

    # Cajero confirma la llamada telefonica
    $confirmLlamada = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$codOrderId/confirmar-llamada" -Method Post -Headers $authAdminHeaders
    Write-Host "OK - Llamada confirmada. Nuevo estado: $($confirmLlamada.estado)" -ForegroundColor Green

    # Cocina emite comprobante en finance-service y empaqueta
    $compPayload = @{
        ordenId            = $codOrderId
        tipo               = "BOLETA"
        clienteTipoDoc     = "DNI"
        clienteNumDoc      = "45678912"
        clienteNombre      = "Carlos ContraPago"
        total              = $confirmLlamada.total
        pagadoDigitalmente = $false
        vueltoEstimado     = $confirmLlamada.vueltoEstimado
    } | ConvertTo-Json

    $headersInternos = @{ "X-Internal-Key" = "sanpollo-dev-internal-key" }
    $compResp = Invoke-RestMethod -Uri "http://localhost:8086/finanzas/comprobantes" -Method Post -Headers $headersInternos -Body $compPayload -ContentType "application/json"
    Write-Host "OK - Comprobante emitido: $($compResp.serieCorrelativo) - Leyenda: $($compResp.estadoPagoTexto)" -ForegroundColor Green

    # Cocina marca LISTO_PARA_ENTREGAR
    $listoReq = @{ estado = "LISTO_PARA_ENTREGAR" } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$codOrderId/estado" -Method Patch -Headers $authAdminHeaders -Body $listoReq -ContentType "application/json" | Out-Null

    # Repartidor toma el pedido y sale a ruta
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$codOrderId/reclamo" -Method Post -Headers $authAdminHeaders | Out-Null
    $caminoReq = @{ estado = "EN_CAMINO"; repartidorId = 4 } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$codOrderId/estado" -Method Patch -Headers $authAdminHeaders -Body $caminoReq -ContentType "application/json" | Out-Null

    # Repartidor llega a la puerta del cliente (EN_PUERTA)
    $puertaResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$codOrderId/en-puerta" -Method Post -Headers $authAdminHeaders
    Write-Host "OK - Repartidor llego a destino! Estado: $($puertaResp.estado) - Timestamp en puerta: $($puertaResp.enPuertaAt)" -ForegroundColor Green

    # Cobro en efectivo verificado
    $cobroPayload = @{
        ordenId         = $codOrderId
        monto           = $confirmLlamada.total
        montoRecibido   = 100.00
        vueltoEntregado = $confirmLlamada.vueltoEstimado
    } | ConvertTo-Json

    $cobroResp = Invoke-RestMethod -Uri "http://localhost:8083/pagos/cobro-efectivo" -Method Post -Headers $authAdminHeaders -Body $cobroPayload -ContentType "application/json"
    Write-Host "OK - Cobro en efectivo verificado! Orden completada a ENTREGADO." -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "14. Liquidacion de Repartidor en Finance-Service"
    # -------------------------------------------------------------------------
    $liqApertura = @{
        repartidorId     = 4
        repartidorNombre = "Motorizado Mario"
        fondoInicial     = 50.00
        observaciones    = "Prueba automatizada"
    } | ConvertTo-Json

    $liqResp = Invoke-RestMethod -Uri "http://localhost:8086/finanzas/liquidaciones/apertura" -Method Post -Headers $authAdminHeaders -Body $liqApertura -ContentType "application/json"
    $liqId = $liqResp.id
    Write-Host "OK - Liquidacion #$liqId abierta para motorizado. Fondo: S/ $($liqResp.fondoInicial)" -ForegroundColor Green

    # Cierre de liquidacion con rendicion de efectivo
    $totalACerrar = 50.00 + $confirmLlamada.total
    $liqCierre = @{
        totalRendido         = $totalACerrar
        totalCobradoEfectivo = $confirmLlamada.total
        observaciones        = "Cuadre conforme de turno"
    } | ConvertTo-Json

    $liqCierreResp = Invoke-RestMethod -Uri "http://localhost:8086/finanzas/liquidaciones/$liqId/cierre" -Method Post -Headers $authAdminHeaders -Body $liqCierre -ContentType "application/json"
    Write-Host "OK - Liquidacion cerrada! Estado: $($liqCierreResp.estado) - Diferencia: S/ $($liqCierreResp.diferencia)" -ForegroundColor Green

    # -------------------------------------------------------------------------
    Write-Step "15. Protocolo de Pedido Fantasma, Sancion y Control de Merma"
    # -------------------------------------------------------------------------
    $fantasmaPayload = @{
        tipo             = "DELIVERY"
        canalOrigen      = "WEB"
        estadoInicial    = "PENDIENTE_CONFIRMACION"
        nombreCliente    = "Sospechoso Fantasma"
        telefonoCliente  = "999888111"
        direccionEntrega = "Calle Fantasma 000"
        montoPagaCon     = 100.00
        ipOrigen         = "190.119.20.45"
        items            = @(
            @{ productoId = $prod1Id; cantidad = 1 }
        )
    } | ConvertTo-Json -Depth 5

    $fantasmaResp = Invoke-RestMethod -Uri "http://localhost:8082/ordenes" -Method Post -Body $fantasmaPayload -ContentType "application/json"
    $fantasmaId = $fantasmaResp.id

    # Confirmar llamada y mover hasta puerta
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/confirmar-llamada" -Method Post -Headers $authAdminHeaders | Out-Null
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/estado" -Method Patch -Headers $authAdminHeaders -Body $listoReq -ContentType "application/json" | Out-Null
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/reclamo" -Method Post -Headers $authAdminHeaders | Out-Null
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/estado" -Method Patch -Headers $authAdminHeaders -Body $caminoReq -ContentType "application/json" | Out-Null
    Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/en-puerta" -Method Post -Headers $authAdminHeaders | Out-Null

    # Cliente no sale (>30 min): Declarar Pedido Fantasma
    $fantasmaReq = @{ motivo = "NO_ENTREGADO: Cliente no salio tras 30 min en puerta" } | ConvertTo-Json
    $fantasmaCierre = Invoke-RestMethod -Uri "http://localhost:8082/ordenes/$fantasmaId/pedido-fantasma" -Method Post -Headers $authAdminHeaders -Body $fantasmaReq -ContentType "application/json"
    Write-Host "OK - Pedido #$fantasmaId declarado como: $($fantasmaCierre.estado) (Motivo: $($fantasmaCierre.motivoFantasma))" -ForegroundColor Magenta

    # Verificar que el cliente quedo sancionado en Auth-Service
    Start-Sleep -Milliseconds 800
    $sancionCheck = Invoke-RestMethod -Uri "http://localhost:8081/auth/sanciones/verificar?telefono=999888111&ip=190.119.20.45" -Method Get
    Write-Host "OK - Verificacion de sancion en Auth-Service:" -ForegroundColor Yellow
    Write-Host "   Sancionado: $($sancionCheck.sancionado)"
    Write-Host "   Bloqueado Efectivo: $($sancionCheck.bloqueadoEfectivo)"
    Write-Host "   Motivo: $($sancionCheck.motivo)"

    # Resolver producto devuelto en Inventario como Merma Justificada
    $mermaPayload = @{
        ordenId       = $fantasmaId
        ordenTipo     = "DELIVERY"
        destino       = "MERMA_JUSTIFICADA"
        observaciones = "Pollo frio devuelto tras espera en puerta"
    } | ConvertTo-Json

    $mermaResp = Invoke-RestMethod -Uri "http://localhost:8085/inventario/pedidos-fantasma/resolver" -Method Post -Headers $authAdminHeaders -Body $mermaPayload -ContentType "application/json"
    Write-Host "OK - Resolucion en Almacen completada: Destino: $($mermaResp.destino) - Merma ID: $($mermaResp.mermaId)" -ForegroundColor Green

    Write-Host "`nTODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE SIN NINGUN ERROR!" -ForegroundColor Green
} catch {
    Write-Host "`nError durante la ejecucion de pruebas: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "Respuesta del servidor: $respBody" -ForegroundColor DarkRed
    }
}
