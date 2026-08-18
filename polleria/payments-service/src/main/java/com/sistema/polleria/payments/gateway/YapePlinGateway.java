package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Pasarela Yape / Plin.
 *
 * Integración real: cada banco/proveedor expone una API distinta.
 * Flujo típico:
 *  1. Cliente ingresa número de teléfono en el frontend.
 *  2. El frontend llama a este servicio con telefonoYape.
 *  3. payments-service solicita un QR/código al proveedor.
 *  4. El proveedor notifica vía webhook cuando el usuario aprueba.
 *  5. payments-service actualiza el estado (PENDIENTE → APROBADO).
 *
 * Por ahora devuelve PENDIENTE para simular el paso 3 (esperando webhook).
 */
@Slf4j
@Component
public class YapePlinGateway implements PaymentGateway {

    @Override
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        if (request.telefonoYape() == null || request.telefonoYape().isBlank()) {
            return new GatewayResult(
                EstadoPago.RECHAZADO,
                null,
                "Número de teléfono Yape/Plin requerido"
            );
        }

        log.info("Iniciando pago Yape/Plin — orden={} teléfono={}", request.ordenId(), request.telefonoYape());

        // TODO: llamar a la API del proveedor para generar QR de cobro
        String referencia = "YAPE-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();

        return new GatewayResult(
            EstadoPago.PENDIENTE,
            referencia,
            "Solicitud Yape/Plin enviada. Esperando confirmación del usuario."
        );
    }
}
