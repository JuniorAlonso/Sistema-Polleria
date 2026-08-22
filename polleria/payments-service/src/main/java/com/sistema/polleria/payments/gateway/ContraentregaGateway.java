package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Contraentrega: el pago queda PENDIENTE hasta que el repartidor confirme la entrega.
 * No requiere integración con pasarela externa.
 */
@Component
public class ContraentregaGateway implements PaymentGateway {

    @Override
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        String referencia = "COD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return new GatewayResult(
            EstadoPago.PENDIENTE,
            referencia,
            "Pago contra entrega registrado. El repartidor cobrará al entregar el pedido."
        );
    }
}
