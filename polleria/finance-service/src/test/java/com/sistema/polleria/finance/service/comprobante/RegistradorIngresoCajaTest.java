package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RegistradorIngresoCajaTest {

    private final ArqueoCajaRepository arqueos = mock(ArqueoCajaRepository.class);
    private final MovimientoCajaRepository movimientos = mock(MovimientoCajaRepository.class);
    private final RegistradorIngresoCaja registrador = new RegistradorIngresoCaja(arqueos, movimientos);

    private void cajaAbierta(long id) {
        when(arqueos.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(ArqueoCaja.builder().id(id).montoApertura(BigDecimal.TEN).build()));
    }

    @Test
    void registraUnIngresoAsociadoALaOrdenEnLaCajaAbierta() {
        cajaAbierta(7L);
        when(movimientos.existsByOrdenIdAndTipo(55L, TipoMovimiento.INGRESO)).thenReturn(false);

        registrador.registrar(55L, new BigDecimal("42.50"), "Venta B001-000003", 9L);

        ArgumentCaptor<MovimientoCaja> captor = ArgumentCaptor.forClass(MovimientoCaja.class);
        verify(movimientos).saveAndFlush(captor.capture());
        MovimientoCaja guardado = captor.getValue();
        assertThat(guardado.getArqueoId()).isEqualTo(7L);
        assertThat(guardado.getOrdenId()).isEqualTo(55L);
        assertThat(guardado.getTipo()).isEqualTo(TipoMovimiento.INGRESO);
        assertThat(guardado.getMonto()).isEqualByComparingTo("42.50");
        assertThat(guardado.getRegistradoPor()).isEqualTo(9L);
    }

    @Test
    void noDuplicaElIngresoSiLaOrdenYaLoTiene() {
        cajaAbierta(7L);
        when(movimientos.existsByOrdenIdAndTipo(55L, TipoMovimiento.INGRESO)).thenReturn(true);

        registrador.registrar(55L, new BigDecimal("42.50"), "Venta", 9L);

        verify(movimientos, never()).saveAndFlush(any());
    }

    @Test
    void sinCajaAbiertaRespondeConflicto() {
        when(arqueos.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> registrador.registrar(55L, BigDecimal.TEN, "Venta", 9L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("caja abierta");
        verify(movimientos, never()).saveAndFlush(any());
    }
}
