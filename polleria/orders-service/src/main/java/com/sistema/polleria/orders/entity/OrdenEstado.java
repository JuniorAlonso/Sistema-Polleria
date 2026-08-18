package com.sistema.polleria.orders.entity;

public enum OrdenEstado {
    RECIBIDO,
    EN_PREPARACION,
    LISTO,        // Listo en cocina (salón y recojo)
    EN_CAMINO,    // Solo delivery
    ENTREGADO,
    CANCELADO
}
