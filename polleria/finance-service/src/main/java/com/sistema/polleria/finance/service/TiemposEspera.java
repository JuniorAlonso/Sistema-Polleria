package com.sistema.polleria.finance.service;

import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.Duration;

/**
 * Timeouts for calls to other services. Receipt emission calls payments and orders inside its
 * database transaction; without a bound a stalled service would hold a pooled connection forever.
 */
final class TiemposEspera {

    static final Duration CONEXION = Duration.ofSeconds(3);
    static final Duration LECTURA = Duration.ofSeconds(5);

    private TiemposEspera() {
    }

    static SimpleClientHttpRequestFactory fabrica() {
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(CONEXION);
        fabrica.setReadTimeout(LECTURA);
        return fabrica;
    }
}
