package com.sistema.polleria.orders.entity;

public enum OrdenEstado {
    RECIBIDO,
    PENDIENTE_CONFIRMACION,   // ContraPago: espera llamada telefónica del cajero (max 15 min)
    PENDIENTE_PAGO,           // WhatsApp Yape/Plin manual: espera captura del comprobante (max 15 min)
    EN_PREPARACION,           // Cocina preparando el pedido
    PREPARANDO,               // Alias semántico de EN_PREPARACION para compatibilidad completa
    LISTO,                    // Listo en cocina
    LISTO_PARA_ENTREGAR,      // Alias semántico de LISTO (empaquetado con comprobante)
    EN_CAMINO,                // Delivery asignado y en ruta
    EN_PUERTA,                // Repartidor llegó a la puerta del cliente (timer 30 min)
    ENTREGADO,                // Pedido completado exitosamente
    CANCELADO,                // Cancelado por cliente o timeout de 15 min
    PEDIDO_FANTASMA;          // No entregado en puerta (>30 min) o abandonado en tienda (>1 hora)

    public boolean esPreparacion() {
        return this == EN_PREPARACION || this == PREPARANDO;
    }

    public boolean esListo() {
        return this == LISTO || this == LISTO_PARA_ENTREGAR;
    }

    public boolean esTerminal() {
        return this == ENTREGADO || this == CANCELADO || this == PEDIDO_FANTASMA;
    }
}

