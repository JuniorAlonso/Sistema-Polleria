package com.sistema.polleria.orders.entity;

/**
 * Canal por el que entró el pedido (S1).
 *
 * Sirve para medir y auditar los pedidos que llegan por WhatsApp: un pedido anónimo de WhatsApp
 * es de tipo {@code DELIVERY}, igual que uno del checkout web, y solo el canal los distingue.
 */
public enum CanalOrigen {
    /** Checkout web o cualquier alta que no especifique canal. */
    WEB,
    /** Pedido tomado desde el WhatsApp del negocio (T3). */
    WHATSAPP,
    /** Comanda de salón, tomada por el personal en el local. */
    SALON
}
