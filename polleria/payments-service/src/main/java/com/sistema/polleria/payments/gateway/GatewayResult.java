package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.entity.EstadoPago;

public record GatewayResult(
    EstadoPago estado,
    String referenciaExterna,
    String detalle
) {}
