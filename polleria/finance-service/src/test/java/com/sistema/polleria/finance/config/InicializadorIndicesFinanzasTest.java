package com.sistema.polleria.finance.config;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

class InicializadorIndicesFinanzasTest {

    @Test
    void creaLosTresIndicesUnicosDeFinanzas() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        new InicializadorIndicesFinanzas(jdbc).run(null);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(3)).execute(sql.capture());
        List<String> sentencias = sql.getAllValues();
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_comprobantes_orden_id").contains("comprobantes_pago (orden_id)"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_arqueos_caja_abierta").contains("WHERE estado = 'ABIERTA'"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_movimientos_ingreso_orden")
                .contains("WHERE orden_id IS NOT NULL AND tipo = 'INGRESO'"));
    }

    @Test
    void unIndiceQueFallaPorDuplicadosNoDetieneElArranqueNiLosDemas() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doThrow(new DataIntegrityViolationException("could not create unique index"))
                .when(jdbc).execute(contains("uq_comprobantes_orden_id"));

        assertThatCode(() -> new InicializadorIndicesFinanzas(jdbc).run(null)).doesNotThrowAnyException();

        verify(jdbc, times(3)).execute(anyString());
    }
}
