package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;

/**
 * Contrato común para todos los proveedores de pago.
 * Nuevo proveedor = nueva implementación de esta interfaz.
 */
public interface PaymentGateway {
    GatewayResult procesar(IniciarPagoRequest request, Long clienteId);
}
