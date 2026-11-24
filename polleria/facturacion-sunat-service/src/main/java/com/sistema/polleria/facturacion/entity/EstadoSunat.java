package com.sistema.polleria.facturacion.entity;

/** Estado del comprobante ante SUNAT. */
public enum EstadoSunat {
    /** Envío en curso hacia SUNAT (evita duplicados concurrentes sin retener conexión DB). */
    ENVIANDO,
    /** SUNAT lo aceptó: el comprobante es válido. */
    ACEPTADO,
    /** Aceptado, pero SUNAT dejó observaciones (también es válido). */
    OBSERVADO,
    /** SUNAT lo rechazó: hay que corregir y reenviar. */
    RECHAZADO,
    /** No se pudo comunicar con SUNAT (caído, sin internet). Se puede reintentar. */
    ERROR;

    /** Aceptado u observado: ya existe para SUNAT y no debe volver a enviarse. */
    public boolean esDefinitivo() {
        return this == ACEPTADO || this == OBSERVADO;
    }
}
