package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.BalanceDiarioResponse;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanzasServiceTest {

    @Mock
    private ArqueoCajaRepository arqueoRepository;

    @Mock
    private MovimientoCajaRepository movimientoRepository;

    @InjectMocks
    private FinanzasService finanzasService;

    @Test
    @DisplayName("Debe consolidar ingresos de salon, digitales y egresos de caja chica en el balance diario")
    void obtenerBalanceDiario_calculaTotalesCorrectamente() {
        LocalDate hoy = LocalDate.of(2026, 10, 9);

        ArqueoCaja arqueo = ArqueoCaja.builder()
                .montoCierreEfectivo(new BigDecimal("450.00"))
                .montoCierrePos(new BigDecimal("350.00"))
                .ventasDigitales(new BigDecimal("200.00"))
                .build();

        MovimientoCaja gasto = MovimientoCaja.builder()
                .monto(new BigDecimal("80.00"))
                .tipo(TipoMovimiento.EGRESO)
                .build();

        when(arqueoRepository.findByFechaAperturaBetweenOrderByFechaAperturaDesc(any(), any()))
                .thenReturn(List.of(arqueo));
        when(movimientoRepository.findByFechaBetweenOrderByFechaDesc(any(), any()))
                .thenReturn(List.of(gasto));

        BalanceDiarioResponse balance = finanzasService.obtenerBalanceDiario(hoy);

        // Ingresos = 450 + 350 + 200 = 1000.00
        assertThat(balance.getIngresos().getTotalIngresos()).isEqualByComparingTo("1000.00");
        assertThat(balance.getIngresos().getEfectivoSalon()).isEqualByComparingTo("450.00");
        assertThat(balance.getIngresos().getPosFisicoSalon()).isEqualByComparingTo("350.00");
        assertThat(balance.getIngresos().getPasarelaDigital()).isEqualByComparingTo("200.00");

        // Egresos = 80.00
        assertThat(balance.getEgresos().getTotalEgresos()).isEqualByComparingTo("80.00");
        assertThat(balance.getEgresos().getGastosCajaChica()).isEqualByComparingTo("80.00");

        // Balance neto = 1000 - 80 = 920.00
        assertThat(balance.getBalanceNeto()).isEqualByComparingTo("920.00");
    }
}
