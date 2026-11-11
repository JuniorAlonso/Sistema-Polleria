package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.service.OrdenesClient;
import com.sistema.polleria.finance.service.PagosClient;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class FuenteTotalPagoUOrdenTest {

    private final PagosClient pagos = mock(PagosClient.class);
    private final OrdenesClient ordenes = mock(OrdenesClient.class);
    private final FuenteTotalComprobante fuente = new FuenteTotalPagoUOrden(pagos, ordenes);

    @Test
    void usaElMontoDelPagoAprobado() {
        when(pagos.obtenerPagoDeOrden(10L, "Bearer t"))
                .thenReturn(Optional.of(new PagosClient.PagoOrden(1L, 10L, new BigDecimal("55.90"), "APROBADO")));

        assertThat(fuente.totalDe(10L, "Bearer t")).isEqualByComparingTo("55.90");
        verifyNoInteractions(ordenes);
    }

    @Test
    void sinPagoUsaElTotalDeLaOrden() {
        when(pagos.obtenerPagoDeOrden(10L, "Bearer t")).thenReturn(Optional.empty());
        when(ordenes.obtenerTotal(10L)).thenReturn(new BigDecimal("82.00"));

        assertThat(fuente.totalDe(10L, "Bearer t")).isEqualByComparingTo("82.00");
    }

    @Test
    void conPagoNoAprobadoUsaElTotalDeLaOrden() {
        when(pagos.obtenerPagoDeOrden(10L, "Bearer t"))
                .thenReturn(Optional.of(new PagosClient.PagoOrden(1L, 10L, new BigDecimal("1.00"), "PENDIENTE")));
        when(ordenes.obtenerTotal(10L)).thenReturn(new BigDecimal("82.00"));

        assertThat(fuente.totalDe(10L, "Bearer t")).isEqualByComparingTo("82.00");
    }

    @Test
    void siPaymentsNoRespondeFallaCerradoSinConsultarLaOrden() {
        when(pagos.obtenerPagoDeOrden(10L, "Bearer t"))
                .thenThrow(new PagosClient.PagosNoDisponibleException("caído", null));

        assertThatThrownBy(() -> fuente.totalDe(10L, "Bearer t"))
                .isInstanceOf(PagosClient.PagosNoDisponibleException.class);
        verifyNoInteractions(ordenes);
    }
}
