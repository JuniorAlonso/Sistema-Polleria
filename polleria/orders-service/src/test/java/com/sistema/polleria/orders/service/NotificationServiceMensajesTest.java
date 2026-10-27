package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** The pickup "ready" message carries the ticket code the cashier checks (POL-<order id>). */
class NotificationServiceMensajesTest {

    @Test
    void elAvisoDeRecojoListoIncluyeElCodigoDelTicket() {
        Orden orden = Orden.builder().id(95L).numeroCliente(4).build();

        String mensaje = NotificationService.mensajeRecojoListo(orden);

        assertTrue(mensaje.contains("POL-95"), mensaje);
        assertTrue(mensaje.contains("#4"), mensaje);
        assertTrue(mensaje.contains("1 hora"), mensaje);
    }
}
