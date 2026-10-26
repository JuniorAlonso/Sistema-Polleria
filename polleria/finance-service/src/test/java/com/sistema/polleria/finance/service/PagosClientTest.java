package com.sistema.polleria.finance.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;

class PagosClientTest {

    // Nothing listens on port 1: the client must fail closed instead of returning a made-up zero.
    private final PagosClient client = new PagosClient("http://localhost:1", "key");

    @Test
    void obtenerPendienteFallaCerradoSiPaymentsNoEstaAlcanzable() {
        assertThrows(PagosClient.PagosNoDisponibleException.class,
                () -> client.obtenerPendiente(4L, null, "Bearer t"));
    }

    @Test
    void liquidarFallaCerradoSiPaymentsNoEstaAlcanzable() {
        assertThrows(PagosClient.PagosNoDisponibleException.class,
                () -> client.liquidar(List.of(1L), 2L, "Bearer t"));
    }
}
