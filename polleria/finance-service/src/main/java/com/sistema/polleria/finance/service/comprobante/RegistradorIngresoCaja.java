package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Cash income of a sale, at most once per order (D3.2). The application check gives the normal
 * answer; the partial unique index {@code uq_movimientos_ingreso_orden} settles a concurrent retry.
 * Manual movements ({@code POST /finanzas/caja/movimientos}) do not go through here.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RegistradorIngresoCaja {

    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;

    public void registrar(Long ordenId, BigDecimal monto, String motivo, Long usuarioId) {
        ArqueoCaja caja = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new IllegalStateException(
                        "No hay una caja abierta: abre la caja antes de registrar un cobro en efectivo"));

        if (movimientoRepository.existsByOrdenIdAndTipo(ordenId, TipoMovimiento.INGRESO)) {
            log.info("Ingreso de la orden #{} ya registrado; no se duplica", ordenId);
            return;
        }

        movimientoRepository.saveAndFlush(MovimientoCaja.builder()
                .arqueoId(caja.getId())
                .ordenId(ordenId)
                .tipo(TipoMovimiento.INGRESO)
                .monto(monto)
                .motivo(motivo)
                .registradoPor(usuarioId)
                .fecha(LocalDateTime.now())
                .build());
        log.info("Ingreso de venta registrado: orden #{} S/ {} en caja #{}", ordenId, monto, caja.getId());
    }
}
