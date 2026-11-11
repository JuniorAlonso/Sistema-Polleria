package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.service.PagosClient;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** A cash income is only recorded for an approved cash payment (D3.13). */
class ValidadorIngresoEfectivoTest {

    private final PagosClient pagos = mock(PagosClient.class);
    private final ValidadorIngresoEfectivo validador = new ValidadorIngresoEfectivo(pagos);

    private void pago(String estado, String metodo) {
        when(pagos.obtenerPagoDeOrden(10L, "Bearer t")).thenReturn(Optional.of(
                new PagosClient.PagoOrden(1L, 10L, new BigDecimal("40.00"), estado, metodo)));
    }

    @Test
    void unPagoAprobadoEnEfectivoPermiteElIngreso() {
        pago("APROBADO", "CONTRAENTREGA");
        assertThatCode(() -> validador.validar(10L, "Bearer t")).doesNotThrowAnyException();
    }

    @Test
    void unPagoConTarjetaOYapeNoEntraALaCaja() {
        pago("APROBADO", "TARJETA");
        assertThatThrownBy(() -> validador.validar(10L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("efectivo");

        pago("APROBADO", "YAPE_PLIN");
        assertThatThrownBy(() -> validador.validar(10L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void sinPagoAprobadoNoHayIngreso() {
        pago("PENDIENTE", "CONTRAENTREGA");
        assertThatThrownBy(() -> validador.validar(10L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("aprobado");

        when(pagos.obtenerPagoDeOrden(10L, "Bearer t")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> validador.validar(10L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class);
    }
}
