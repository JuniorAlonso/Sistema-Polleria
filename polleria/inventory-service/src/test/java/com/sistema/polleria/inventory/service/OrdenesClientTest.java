package com.sistema.polleria.inventory.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class OrdenesClientTest {

    // Nothing listens on port 1: the client must fail closed instead of guessing the order state.
    private final OrdenesClient client = new OrdenesClient("http://localhost:1", "key");

    @Test
    void obtenerEstadoFallaCerradoSiOrdersNoEstaAlcanzable() {
        assertThrows(OrdenesClient.OrdenesNoDisponibleException.class, () -> client.obtenerEstado(1L));
    }
}
