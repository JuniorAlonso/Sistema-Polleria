package com.sistema.polleria.facturacion.service;

import lombok.Getter;

/** Error propagado cuando un microservicio interno responde 401 o 403 al reenviar el JWT. */
@Getter
public class AccesoRechazadoInternoException extends RuntimeException {
    private final int status;

    public AccesoRechazadoInternoException(int status, String mensaje) {
        super(mensaje);
        this.status = status;
    }
}
