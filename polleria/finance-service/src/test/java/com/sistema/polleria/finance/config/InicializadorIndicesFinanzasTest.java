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
    void creaLosIndicesUnicosDeFinanzas() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        new InicializadorIndicesFinanzas(jdbc).run(null);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(14)).execute(sql.capture());
        List<String> sentencias = sql.getAllValues();
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_comprobantes_orden_id").contains("comprobantes_pago (orden_id)"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_arqueos_caja_abierta").contains("WHERE estado = 'ABIERTA'"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_liquidacion_abierta_repartidor").contains("liquidaciones_repartidores (repartidor_id)")
                .contains("WHERE estado = 'ABIERTA'"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_movimientos_ingreso_orden")
                .contains("WHERE orden_id IS NOT NULL AND tipo = 'INGRESO'"));
        assertThat(sentencias).anySatisfy(s -> assertThat(s)
                .contains("uq_movimientos_devolucion_reclamo").contains("movimientos_caja (reclamo_id)")
                .contains("WHERE categoria = 'DEVOLUCION'"));
    }

    @Test
    void realineaElCheckDeCategoriaParaAceptarLosValoresNuevos() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        new InicializadorIndicesFinanzas(jdbc).run(null);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeastOnce()).execute(sql.capture());
        assertThat(sql.getAllValues()).anySatisfy(s -> assertThat(s)
                .contains("DROP CONSTRAINT IF EXISTS movimientos_caja_categoria_check")
                .contains("ADD CONSTRAINT movimientos_caja_categoria_check")
                .contains("'DEVOLUCION'").contains("'VENTA'").contains("categoria IS NULL"));
    }

    @Test
    void omiteAlterTableCuandoLosChecksYaContienenTodosLosValores() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.RowMapper<String>>any(), any(), any()))
                .thenReturn(List.of("CHECK (col IS NULL OR col IN ('VENTA','FONDO_REPARTIDOR','RENDICION_REPARTIDOR','MANUAL','DEVOLUCION','INGRESO','EGRESO','ABIERTA','CERRADA','DISCREPANCIA','BOLETA','FACTURA'))"));

        new InicializadorIndicesFinanzas(jdbc).run(null);

        verify(jdbc, times(9)).execute(anyString());
        verify(jdbc, never()).execute(contains("ALTER TABLE"));
    }

    @Test
    void unIndiceQueFallaPorDuplicadosNoDetieneElArranqueNiLosDemas() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doThrow(new DataIntegrityViolationException("could not create unique index"))
                .when(jdbc).execute(contains("uq_comprobantes_orden_id"));

        assertThatCode(() -> new InicializadorIndicesFinanzas(jdbc).run(null)).doesNotThrowAnyException();

        verify(jdbc, times(14)).execute(anyString());
    }
}
