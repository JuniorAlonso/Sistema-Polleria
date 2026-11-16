package com.sistema.polleria.finance.service;

import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * Timeouts for calls to other services. Receipt emission calls payments and orders outside database
 * locks; without a bound a stalled service would block request threads indefinitely.
 */
final class TiemposEspera {

    static final Duration CONEXION = Duration.ofSeconds(3);
    static final Duration LECTURA = Duration.ofSeconds(5);

    private TiemposEspera() {
    }

    static ClientHttpRequestFactory fabrica() {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(CONEXION)
                .build();
        JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(client);
        fabrica.setReadTimeout(LECTURA);
        return fabrica;
    }
}
