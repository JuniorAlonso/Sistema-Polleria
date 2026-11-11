package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ValidadorDatosFiscalesTest {

    private final ValidadorDatosFiscales validador =
            new ValidadorDatosFiscales(List.of(new ReglaBoleta(), new ReglaFactura()));

    private static final BigDecimal SETECIENTOS = new BigDecimal("700.00");
    private static final BigDecimal SOBRE_SETECIENTOS = new BigDecimal("700.01");

    @Test
    void facturaSinRucEsRechazada() {
        assertThatThrownBy(() -> validador.validar(TipoComprobante.FACTURA, null, new BigDecimal("50")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("RUC");
    }

    @Test
    void facturaConRucDeDiezDigitosEsRechazada() {
        assertThatThrownBy(() -> validador.validar(TipoComprobante.FACTURA, "2012345678", new BigDecimal("50")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("11 dígitos");
    }

    @Test
    void facturaConRucDeOnceDigitosEsAceptada() {
        assertThatCode(() -> validador.validar(TipoComprobante.FACTURA, "20123456789", new BigDecimal("50")))
                .doesNotThrowAnyException();
    }

    @Test
    void boletaAConsumidorFinalHastaSetecientosEsAceptada() {
        assertThatCode(() -> validador.validar(TipoComprobante.BOLETA, null, SETECIENTOS))
                .doesNotThrowAnyException();
    }

    @Test
    void boletaSobreSetecientosSinDniEsRechazada() {
        assertThatThrownBy(() -> validador.validar(TipoComprobante.BOLETA, null, SOBRE_SETECIENTOS))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("700");
    }

    @Test
    void boletaSobreSetecientosConDniDeCerosEsRechazada() {
        assertThatThrownBy(() -> validador.validar(TipoComprobante.BOLETA, "00000000", SOBRE_SETECIENTOS))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void boletaSobreSetecientosConDniRealEsAceptada() {
        assertThatCode(() -> validador.validar(TipoComprobante.BOLETA, "72345678", SOBRE_SETECIENTOS))
                .doesNotThrowAnyException();
    }
}
