package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.EfectivoPendienteResponse;
import com.sistema.polleria.payments.service.PagoService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** S6: who may read a courier's pending cash (the role gate itself is @PreAuthorize on the endpoint). */
class EfectivoRepartidorControllerTest {

    private final PagoService pagoService = mock(PagoService.class);
    private final PagoController controller = new PagoController(pagoService, null, null);

    private static UsernamePasswordAuthenticationToken usuario(long id, String rol) {
        return new UsernamePasswordAuthenticationToken("u@x.com", id, List.of(new SimpleGrantedAuthority(rol)));
    }

    @Test
    void repartidorSoloVeSuPropioEfectivo() {
        var yo = usuario(4L, "REPARTIDOR");
        assertThrows(AccessDeniedException.class, () -> controller.efectivoPendiente(5L, null, yo, yo));
    }

    @Test
    void repartidorVeSuPropioEfectivo() {
        var yo = usuario(4L, "REPARTIDOR");
        var esperado = new EfectivoPendienteResponse(4L, new BigDecimal("10.00"), 1, List.of());
        when(pagoService.efectivoPendiente(any(), any())).thenReturn(esperado);

        assertEquals(esperado, controller.efectivoPendiente(4L, null, yo, yo));
    }

    @Test
    void cajeroVeElEfectivoDeCualquierRepartidor() {
        var cajero = usuario(2L, "CAJERO");
        var esperado = new EfectivoPendienteResponse(5L, BigDecimal.ZERO, 0, List.of());
        when(pagoService.efectivoPendiente(any(), any())).thenReturn(esperado);

        assertEquals(esperado, controller.efectivoPendiente(5L, null, cajero, cajero));
    }
}
