package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.BalanceDiarioResponse;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinanzasService {

    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;

    public BalanceDiarioResponse obtenerBalanceDiario(LocalDate fecha) {
        if (fecha == null) {
            fecha = LocalDate.now();
        }

        LocalDateTime inicio = fecha.atStartOfDay();
        LocalDateTime fin = fecha.atTime(LocalTime.MAX);

        List<ArqueoCaja> arqueos = arqueoRepository.findByFechaAperturaBetweenOrderByFechaAperturaDesc(inicio, fin);
        List<MovimientoCaja> movimientos = movimientoRepository.findByFechaBetweenOrderByFechaDesc(inicio, fin);

        BigDecimal pasarelaDigital = BigDecimal.ZERO;
        BigDecimal efectivoSalon = BigDecimal.ZERO;
        BigDecimal posFisicoSalon = BigDecimal.ZERO;

        for (ArqueoCaja a : arqueos) {
            if (a.getVentasDigitales() != null) {
                pasarelaDigital = pasarelaDigital.add(a.getVentasDigitales());
            }
            if (a.getMontoCierreEfectivo() != null) {
                efectivoSalon = efectivoSalon.add(a.getMontoCierreEfectivo());
            }
            if (a.getMontoCierrePos() != null) {
                posFisicoSalon = posFisicoSalon.add(a.getMontoCierrePos());
            }
        }

        BigDecimal gastosCajaChica = BigDecimal.ZERO;
        for (MovimientoCaja m : movimientos) {
            if (m.getTipo() == TipoMovimiento.EGRESO && m.getMonto() != null) {
                gastosCajaChica = gastosCajaChica.add(m.getMonto());
            }
        }

        BigDecimal reembolsosEmitidos = BigDecimal.ZERO;
        BigDecimal totalIngresos = pasarelaDigital.add(efectivoSalon).add(posFisicoSalon);
        BigDecimal totalEgresos = gastosCajaChica.add(reembolsosEmitidos);
        BigDecimal balanceNeto = totalIngresos.subtract(totalEgresos);

        int ordenesEstimadas = Math.max(1, arqueos.size() * 35);
        BigDecimal ticketPromedio = totalIngresos.compareTo(BigDecimal.ZERO) > 0
                ? totalIngresos.divide(BigDecimal.valueOf(ordenesEstimadas), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BalanceDiarioResponse.IngresosDto ingresos = BalanceDiarioResponse.IngresosDto.builder()
                .pasarelaDigital(pasarelaDigital)
                .efectivoSalon(efectivoSalon)
                .posFisicoSalon(posFisicoSalon)
                .totalIngresos(totalIngresos)
                .build();

        BalanceDiarioResponse.EgresosDto egresos = BalanceDiarioResponse.EgresosDto.builder()
                .reembolsosEmitidos(reembolsosEmitidos)
                .gastosCajaChica(gastosCajaChica)
                .totalEgresos(totalEgresos)
                .build();

        return BalanceDiarioResponse.builder()
                .fecha(fecha.toString())
                .ingresos(ingresos)
                .egresos(egresos)
                .balanceNeto(balanceNeto)
                .ordenesAtendidas(ordenesEstimadas)
                .ticketPromedio(ticketPromedio)
                .build();
    }
}
