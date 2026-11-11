package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GeneradorCorrelativoTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final GeneradorCorrelativo generador = new GeneradorCorrelativo(jdbc);

    @Test
    void bloqueaPorTipoAntesDeLeerElUltimoNumeroYDevuelveElSiguiente() {
        when(jdbc.queryForObject(contains("MAX"), eq(Long.class), eq("B001-"), eq("BOLETA"))).thenReturn(41L);

        String serie = generador.siguiente(TipoComprobante.BOLETA);

        assertThat(serie).isEqualTo("B001-000042");
        InOrder orden = inOrder(jdbc);
        orden.verify(jdbc).query(contains("pg_advisory_xact_lock"), any(ResultSetExtractor.class),
                eq(GeneradorCorrelativo.claveBloqueo(TipoComprobante.BOLETA)));
        orden.verify(jdbc).queryForObject(contains("MAX"), eq(Long.class), eq("B001-"), eq("BOLETA"));
    }

    @Test
    void facturaUsaSuPropiaSerieYSuPropioBloqueo() {
        when(jdbc.queryForObject(contains("MAX"), eq(Long.class), eq("F001-"), eq("FACTURA"))).thenReturn(0L);

        assertThat(generador.siguiente(TipoComprobante.FACTURA)).isEqualTo("F001-000001");
        assertThat(GeneradorCorrelativo.claveBloqueo(TipoComprobante.FACTURA))
                .isNotEqualTo(GeneradorCorrelativo.claveBloqueo(TipoComprobante.BOLETA));
    }
}
