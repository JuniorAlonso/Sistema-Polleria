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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Daily balance from the stored records only (plan 03, R3.10):
 * <ul>
 *   <li>sales and served orders come from the receipts issued that day;</li>
 *   <li>cash sales are the INGRESO movements that are sales (POS cash and courier hand-ins), without
 *       the courier change float;</li>
 *   <li>expenses are the EGRESO movements without the float handed to couriers;</li>
 *   <li>card payments at the POS terminal come from the cash counts, the rest of the receipts is
 *       digital.</li>
 * </ul>
 * Movements stored before the category existed keep the previous rule: INGRESO is a sale, EGRESO an
 * expense.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FinanzasService {

    private static final Set<CategoriaMovimiento> NO_SON_VENTA =
            Set.of(CategoriaMovimiento.FONDO_REPARTIDOR, CategoriaMovimiento.MANUAL);

    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final ComprobantePagoRepository comprobanteRepository;

    @Transactional(readOnly = true)
    public BalanceDiarioResponse obtenerBalanceDiario(LocalDate fecha) {
        if (fecha == null) {
            fecha = LocalDate.now();
        }
        LocalDateTime inicio = fecha.atStartOfDay();
        LocalDateTime fin = fecha.atTime(LocalTime.MAX);

        List<MovimientoCaja> movimientos = movimientoRepository.findByFechaBetweenOrderByFechaDesc(inicio, fin);
        List<ComprobantePago> comprobantes = comprobanteRepository.findByEmitidoEnBetween(inicio, fin);
        List<ArqueoCaja> arqueos = arqueoRepository.findByFechaAperturaBetweenOrderByFechaAperturaDesc(inicio, fin);

        BigDecimal efectivo = sumar(movimientos, m -> m.getTipo() == TipoMovimiento.INGRESO
                && (m.getCategoria() == null || !NO_SON_VENTA.contains(m.getCategoria())));
        BigDecimal gastos = sumar(movimientos, m -> m.getTipo() == TipoMovimiento.EGRESO
                && m.getCategoria() != CategoriaMovimiento.FONDO_REPARTIDOR);

        BigDecimal totalVentas = comprobantes.stream().map(ComprobantePago::getTotal)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal posFisico = arqueos.stream().map(ArqueoCaja::getMontoCierrePos)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal digital = totalVentas.subtract(efectivo).subtract(posFisico).max(BigDecimal.ZERO);

        int ordenes = comprobantes.size();
        BigDecimal ticketPromedio = ordenes > 0
                ? totalVentas.divide(BigDecimal.valueOf(ordenes), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal reembolsos = BigDecimal.ZERO;
        BigDecimal totalEgresos = gastos.add(reembolsos);

        return BalanceDiarioResponse.builder()
                .fecha(fecha.toString())
                .ingresos(BalanceDiarioResponse.IngresosDto.builder()
                        .pasarelaDigital(digital)
                        .efectivoSalon(efectivo)
                        .posFisicoSalon(posFisico)
                        .totalIngresos(totalVentas)
                        .build())
                .egresos(BalanceDiarioResponse.EgresosDto.builder()
                        .reembolsosEmitidos(reembolsos)
                        .gastosCajaChica(gastos)
                        .totalEgresos(totalEgresos)
                        .build())
                .balanceNeto(totalVentas.subtract(totalEgresos))
                .ordenesAtendidas(ordenes)
                .ticketPromedio(ticketPromedio)
                .build();
    }

    private static BigDecimal sumar(List<MovimientoCaja> movimientos, Predicate<MovimientoCaja> filtro) {
        return movimientos.stream().filter(filtro).map(MovimientoCaja::getMonto)
                .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
