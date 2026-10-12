package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;

import com.sistema.polleria.payments.entity.MetodoPago;

/**
 * Contrato común para todos los proveedores de pago.
 * Nuevo proveedor = nueva implementación de esta interfaz.
 */
public interface PaymentGateway {
    GatewayResult procesar(IniciarPagoRequest request, Long clienteId);
    default boolean supports(MetodoPago metodoPago) {
        return true;
    }
}

