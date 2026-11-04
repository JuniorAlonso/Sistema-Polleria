package com.sistema.polleria.orders.exception;

/**
 * Conflicto de estado del dominio: la operación se rechaza porque el recurso está en un
 * estado que no la admite (por ejemplo, una mesa que ya tiene una comanda activa, o una
 * transición de estado de mesa no permitida).
 *
 * Se traduce a HTTP 409 Conflict. Antes de existir este tipo, el manejador global no
 * reconocía la excepción y el cliente recibía un HTTP 500 con traza completa de Tomcat.
 */
public class ConflictoDeEstadoException extends IllegalStateException {

    public ConflictoDeEstadoException(String message) {
        super(message);
    }
}
