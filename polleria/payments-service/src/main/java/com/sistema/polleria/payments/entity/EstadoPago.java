package com.sistema.polleria.payments.entity;

public enum EstadoPago {
    PENDIENTE,
    APROBADO,
    RECHAZADO,
    CANCELADO,
    REEMBOLSADO,
    REEMBOLSADO_PARCIAL,

    /**
     * Yape/Plin recibido por WhatsApp (S6): el comprobante está registrado pero todavía no fue
     * verificado por el administrador. Es el estado inicial del flujo de pago por Yape y no
     * altera las transiciones de los estados anteriores.
     */
    PENDIENTE_VERIFICACION
}
