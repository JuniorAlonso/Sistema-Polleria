package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.BalanceDiarioResponse;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.CategoriaMovimiento;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
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

/** Daily report from the real records: cash movements and issued receipts (plan 03, R3.10). */
@ExtendWith(MockitoExtension.class)
class FinanzasServiceTest {

    @Mock
    private ArqueoCajaRepository arqueoRepository;

    @Mock
    private MovimientoCajaRepository movimientoRepository;

    @Mock
    private ComprobantePagoRepository comprobanteRepository;

    @InjectMocks
    private FinanzasService finanzasService;

    private static final LocalDate HOY = LocalDate.of(2026, 10, 9);

    private static MovimientoCaja mov(TipoMovimiento tipo, CategoriaMovimiento categoria, String monto) {
        return MovimientoCaja.builder().tipo(tipo).categoria(categoria).monto(new BigDecimal(monto)).motivo("x").build();
    }

    private static ComprobantePago comprobante(long ordenId, String total) {
        return ComprobantePago.builder().ordenId(ordenId).total(new BigDecimal(total)).build();
    }

    private static MovimientoCaja ventaEfectivo(long ordenId, String monto) {
        MovimientoCaja m = mov(TipoMovimiento.INGRESO, CategoriaMovimiento.VENTA, monto);
        m.setOrdenId(ordenId);
        return m;
    }

    private void dia(List<MovimientoCaja> movimientos, List<ComprobantePago> comprobantes, List<ArqueoCaja> arqueos) {
        when(movimientoRepository.findByFechaBetweenOrderByFechaDesc(any(), any())).thenReturn(movimientos);
        when(comprobanteRepository.findByEmitidoEnBetween(any(), any())).thenReturn(comprobantes);
        when(arqueoRepository.findByFechaAperturaBetweenOrderByFechaAperturaDesc(any(), any())).thenReturn(arqueos);
    }

    @Test
    @DisplayName("R3.10: ventas = efectivo + POS + digital; órdenes y ticket de comprobantes; sin fondos")
    void balanceCuadraConMovimientosYComprobantes() {
        dia(List.of(
                        ventaEfectivo(1L, "40.00"),
                        mov(TipoMovimiento.INGRESO, CategoriaMovimiento.RENDICION_REPARTIDOR, "60.00"),
                        mov(TipoMovimiento.INGRESO, CategoriaMovimiento.FONDO_REPARTIDOR, "20.00"),
                        mov(TipoMovimiento.INGRESO, CategoriaMovimiento.MANUAL, "5.00"),
                        mov(TipoMovimiento.EGRESO, CategoriaMovimiento.FONDO_REPARTIDOR, "20.00"),
                        mov(TipoMovimiento.EGRESO, CategoriaMovimiento.MANUAL, "15.00")),
                // order 1 paid cash at the POS; 2 and 3 by card/Yape (no cash income)
                List.of(comprobante(1L, "40.00"), comprobante(2L, "50.00"), comprobante(3L, "30.00")),
                List.of(ArqueoCaja.builder().montoCierrePos(new BigDecimal("8.00")).build()));

        BalanceDiarioResponse r = finanzasService.obtenerBalanceDiario(HOY);

        assertThat(r.getIngresos().getEfectivoSalon()).isEqualByComparingTo("100.00");
        assertThat(r.getIngresos().getPosFisicoSalon()).isEqualByComparingTo("8.00");
        // non-cash receipts 80, of which 8 went through the card terminal
        assertThat(r.getIngresos().getPasarelaDigital()).isEqualByComparingTo("72.00");
        assertThat(r.getIngresos().getTotalIngresos()).isEqualByComparingTo("180.00");
        assertThat(r.getEgresos().getGastosCajaChica()).isEqualByComparingTo("15.00");
        assertThat(r.getEgresos().getTotalEgresos()).isEqualByComparingTo("15.00");
        assertThat(r.getBalanceNeto()).isEqualByComparingTo("165.00");
        assertThat(r.getOrdenesAtendidas()).isEqualTo(3);
        assertThat(r.getTicketPromedio()).isEqualByComparingTo("40.00");
    }

    @Test
    @DisplayName("Un día sin comprobantes no inventa órdenes ni ticket promedio")
    void sinComprobantesNoEstimaOrdenes() {
        dia(List.of(), List.of(), List.of(ArqueoCaja.builder().build(), ArqueoCaja.builder().build()));

        BalanceDiarioResponse r = finanzasService.obtenerBalanceDiario(HOY);

        assertThat(r.getOrdenesAtendidas()).isZero();
        assertThat(r.getTicketPromedio()).isEqualByComparingTo("0");
        assertThat(r.getIngresos().getTotalIngresos()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Movimientos anteriores a la categoría se informan como antes: INGRESO es venta, EGRESO es gasto")
    void movimientosSinCategoriaMantienenElCriterioAnterior() {
        dia(List.of(
                        mov(TipoMovimiento.INGRESO, null, "25.00"),
                        mov(TipoMovimiento.EGRESO, null, "7.00")),
                List.of(comprobante(9L, "25.00")),
                List.of());

        BalanceDiarioResponse r = finanzasService.obtenerBalanceDiario(HOY);

        assertThat(r.getIngresos().getEfectivoSalon()).isEqualByComparingTo("25.00");
        assertThat(r.getEgresos().getGastosCajaChica()).isEqualByComparingTo("7.00");
    }

    @Test
    @DisplayName("El efectivo que rinden los repartidores cuenta como venta aunque no tenga comprobante")
    void deliverySinComprobanteNoDejaElBalanceNegativo() {
        dia(List.of(
                        mov(TipoMovimiento.INGRESO, CategoriaMovimiento.RENDICION_REPARTIDOR, "310.00"),
                        mov(TipoMovimiento.EGRESO, CategoriaMovimiento.MANUAL, "30.00")),
                List.of(comprobante(5L, "1.00"), comprobante(6L, "1.00")),
                List.of());

        BalanceDiarioResponse r = finanzasService.obtenerBalanceDiario(HOY);

        assertThat(r.getIngresos().getTotalIngresos()).isEqualByComparingTo("312.00");
        assertThat(r.getBalanceNeto()).isEqualByComparingTo("282.00");
        assertThat(r.getTicketPromedio()).as("ticket from receipts only").isEqualByComparingTo("1.00");
    }
}
