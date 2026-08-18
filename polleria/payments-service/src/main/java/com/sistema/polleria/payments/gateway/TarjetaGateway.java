package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Pasarela de tarjeta (Culqi / Niubiz / Izipay).
 *
 * Integración real: POST a la API de la pasarela con el tokenPasarela
 * (generado por el SDK del cliente) y las credenciales privadas de comercio.
 * Por ahora simula la respuesta para que el flujo completo funcione.
 *
 * Para producción: inyectar RestClient, leer API_KEY desde env, parsear
 * la respuesta HTTP de la pasarela y mapear al GatewayResult.
 */
@Slf4j
@Component
public class TarjetaGateway implements PaymentGateway {

    @Override
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        if (request.tokenPasarela() == null || request.tokenPasarela().isBlank()) {
            return new GatewayResult(
                EstadoPago.RECHAZADO,
                null,
                "Token de pasarela requerido para pago con tarjeta"
            );
        }

        log.info("Procesando pago con tarjeta — orden={} monto={}", request.ordenId(), request.monto());

        // TODO: llamar a POST https://api.culqi.com/v2/charges con request.tokenPasarela()
        String referencia = "TXN-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();

        return new GatewayResult(
            EstadoPago.APROBADO,
            referencia,
            "Cargo aprobado por pasarela de tarjeta"
        );
    }
}
