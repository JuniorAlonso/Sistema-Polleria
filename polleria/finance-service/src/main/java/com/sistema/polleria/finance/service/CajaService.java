package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.AperturaCajaRequest;
import com.sistema.polleria.finance.dto.ArqueoCajaResponse;
import com.sistema.polleria.finance.dto.CierreCajaRequest;
import com.sistema.polleria.finance.dto.MovimientoCajaRequest;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class CajaService {

    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;

    @Transactional
    public ArqueoCajaResponse abrirCaja(AperturaCajaRequest req, Long usuarioId) {
        arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .ifPresent(a -> {
                    throw new IllegalStateException("Ya existe una caja abierta (ID #" + a.getId() + "). Debe cerrarse antes de una nueva apertura.");
                });

        ArqueoCaja arqueo = ArqueoCaja.builder()
                .usuarioId(usuarioId)
                .usuarioNombre(req.getUsuarioNombre() != null ? req.getUsuarioNombre() : "Cajero")
                .montoApertura(req.getMontoApertura())
                .estado(EstadoCaja.ABIERTA)
                .observaciones(req.getObservaciones())
                .fechaApertura(LocalDateTime.now())
                .build();

        try {
            // Flush now so the partial unique index uq_arqueos_caja_abierta settles a simultaneous
            // opening here, as a 409, instead of at commit time as a 500 (R3.1, D3.11).
            arqueo = arqueoRepository.saveAndFlush(arqueo);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Ya existe una caja abierta. Debe cerrarse antes de una nueva apertura.", e);
        }
        log.info("Caja abierta: #{} con fondo inicial de S/ {}", arqueo.getId(), arqueo.getMontoApertura());
        return ArqueoCajaResponse.from(arqueo);
    }

    public ArqueoCajaResponse obtenerCajaActual() {
        ArqueoCaja arqueo = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new NoSuchElementException("No hay ninguna caja abierta actualmente"));
        return ArqueoCajaResponse.from(arqueo);
    }

    /**
     * Movimientos de la caja abierta, del más reciente al más antiguo. Si no hay caja abierta
     * devuelve una lista vacía: es una consulta de lectura para el panel, no un error.
     */
    @Transactional(readOnly = true)
    public List<MovimientoCaja> listarMovimientosDeCajaAbierta() {
        return arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .map(arqueo -> movimientoRepository.findByArqueoIdOrderByFechaDesc(arqueo.getId()))
                .orElseGet(List::of);
    }

    @Transactional
    public MovimientoCaja registrarMovimiento(MovimientoCajaRequest req, Long usuarioId) {
        ArqueoCaja actual = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new IllegalStateException("No hay una caja abierta para registrar movimientos"));

        MovimientoCaja movimiento = MovimientoCaja.builder()
                .arqueoId(actual.getId())
                .tipo(req.getTipo())
                .monto(req.getMonto())
                .motivo(req.getMotivo())
                .registradoPor(usuarioId)
                .fecha(LocalDateTime.now())
                .build();

        movimiento = movimientoRepository.save(movimiento);
        log.info("Movimiento de caja registrado: #{} - {} S/ {} ({})",
                movimiento.getId(), movimiento.getTipo(), movimiento.getMonto(), movimiento.getMotivo());
        return movimiento;
    }

    @Transactional
    public ArqueoCajaResponse cerrarCaja(Long arqueoId, CierreCajaRequest req, Long usuarioId) {
        ArqueoCaja arqueo = (arqueoId != null)
                ? arqueoRepository.findById(arqueoId).orElseThrow(() -> new NoSuchElementException("Arqueo no encontrado: " + arqueoId))
                : arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new NoSuchElementException("No hay ninguna caja abierta para cerrar"));

        if (arqueo.getEstado() == EstadoCaja.CERRADA) {
            throw new IllegalStateException("La caja #" + arqueo.getId() + " ya fue cerrada anteriormente.");
        }

        // Calcular movimientos de caja chica
        List<MovimientoCaja> ingresos = movimientoRepository.findByArqueoIdAndTipo(arqueo.getId(), TipoMovimiento.INGRESO);
        List<MovimientoCaja> egresos = movimientoRepository.findByArqueoIdAndTipo(arqueo.getId(), TipoMovimiento.EGRESO);

        BigDecimal totalIngresosCaja = ingresos.stream().map(MovimientoCaja::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalEgresosCaja = egresos.stream().map(MovimientoCaja::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalEsperado = arqueo.getMontoApertura().add(totalIngresosCaja).subtract(totalEgresosCaja);
        BigDecimal diferencia = req.getMontoCierreEfectivo().subtract(totalEsperado);

        // Blind count (D3.12, R3.8): a difference needs a reason. The message never states the
        // expected amount or the difference, otherwise the cashier could just retype the count.
        if (diferencia.signum() != 0 && (req.getObservaciones() == null || req.getObservaciones().isBlank())) {
            throw new IllegalArgumentException(
                    "El efectivo contado no coincide con el esperado. Vuelve a contar o indica el motivo en las observaciones.");
        }

        arqueo.setFechaCierre(LocalDateTime.now());
        arqueo.setMontoCierreEfectivo(req.getMontoCierreEfectivo());
        arqueo.setMontoCierrePos(req.getMontoCierrePos());
        arqueo.setVentasDigitales(req.getVentasDigitales() != null ? req.getVentasDigitales() : BigDecimal.ZERO);
        arqueo.setTotalEsperado(totalEsperado);
        arqueo.setDiferencia(diferencia);
        arqueo.setEstado(EstadoCaja.CERRADA);
        arqueo.setCerradoPor(usuarioId);
        if (req.getObservaciones() != null) {
            arqueo.setObservaciones(req.getObservaciones());
        }

        arqueo = arqueoRepository.save(arqueo);
        log.info("Caja #{} cerrada: Efectivo contado S/ {}, Esperado S/ {}, Diferencia S/ {}",
                arqueo.getId(), arqueo.getMontoCierreEfectivo(), totalEsperado, diferencia);

        return ArqueoCajaResponse.from(arqueo);
    }

    public List<ArqueoCajaResponse> listarHistorial() {
        return arqueoRepository.findAllByOrderByFechaAperturaDesc()
                .stream().map(ArqueoCajaResponse::from).toList();
    }
}
