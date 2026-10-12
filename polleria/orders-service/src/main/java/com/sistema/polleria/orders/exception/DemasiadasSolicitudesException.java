package com.sistema.polleria.orders.exception;

/** Se responde con 429 Too Many Requests. */
public class DemasiadasSolicitudesException extends RuntimeException {
    public DemasiadasSolicitudesException(String message) {
        super(message);
    }
}
