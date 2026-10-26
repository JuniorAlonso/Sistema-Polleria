package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.AperturaLiquidacionRequest;
import com.sistema.polleria.finance.dto.CierreLiquidacionRequest;
import com.sistema.polleria.finance.dto.LiquidacionResponse;
import com.sistema.polleria.finance.entity.*;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.LiquidacionRepartidorRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiquidacionService {

    private final LiquidacionRepartidorRepository liquidacionRepository;
    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;

    @Transactional
    public LiquidacionResponse abrir(AperturaLiquidacionRequest req, Long cajeroId) {
        // Verificar si el repartidor ya tiene una liquidación abierta
        liquidacionRepository.findFirstByRepartidorIdAndEstado(req.repartidorId(), EstadoLiquidacion.ABIERTA)
                .ifPresent(l -> {
                    throw new IllegalStateException("El repartidor " + req.repartidorNombre()
                            + " ya tiene una liquidación abierta (ID #" + l.getId() + ")");
                });

        var arqueoOpt = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .repartidorId(req.repartidorId())
                .repartidorNombre(req.repartidorNombre())
                .arqueoCajaId(arqueoOpt.map(ArqueoCaja::getId).orElse(null))
                .fondoInicial(req.fondoInicial())
                .totalCobradoEfectivo(BigDecimal.ZERO)
                .totalRendido(BigDecimal.ZERO)
                .diferencia(BigDecimal.ZERO)
                .estado(EstadoLiquidacion.ABIERTA)
                .observaciones(req.observaciones())
                .creadoEn(LocalDateTime.now())
                .build();

        liq = liquidacionRepository.save(liq);

        // Si se entregó fondo inicial desde la caja chica, registrar movimiento de egreso
        if (arqueoOpt.isPresent() && req.fondoInicial().compareTo(BigDecimal.ZERO) > 0) {
            MovimientoCaja egreso = MovimientoCaja.builder()
                    .arqueoId(arqueoOpt.get().getId())
                    .tipo(TipoMovimiento.EGRESO)
                    .monto(req.fondoInicial())
                    .motivo("Fondo de vueltos entregado al repartidor " + req.repartidorNombre() + " (Liq #" + liq.getId() + ")")
                    .registradoPor(cajeroId)
                    .fecha(LocalDateTime.now())
                    .build();
            movimientoRepository.save(egreso);
        }

        log.info("Liquidación abierta #{} para repartidor {} con fondo de S/ {}",
                liq.getId(), req.repartidorNombre(), req.fondoInicial());

        return LiquidacionResponse.from(liq);
    }

    @Transactional
    public LiquidacionResponse registrarCobroEnRuta(Long repartidorId, BigDecimal montoCobrado) {
        LiquidacionRepartidor liq = liquidacionRepository.findFirstByRepartidorIdAndEstado(repartidorId, EstadoLiquidacion.ABIERTA)
                .orElse(null);

        if (liq == null) {
            log.warn("No hay liquidación abierta para repartidor ID {}. Creando registro base.", repartidorId);
            liq = LiquidacionRepartidor.builder()
                    .repartidorId(repartidorId)
                    .repartidorNombre("Repartidor #" + repartidorId)
                    .fondoInicial(BigDecimal.ZERO)
                    .totalCobradoEfectivo(montoCobrado)
                    .totalRendido(BigDecimal.ZERO)
                    .diferencia(BigDecimal.ZERO)
                    .estado(EstadoLiquidacion.ABIERTA)
                    .creadoEn(LocalDateTime.now())
                    .build();
        } else {
            liq.setTotalCobradoEfectivo(liq.getTotalCobradoEfectivo().add(montoCobrado));
        }

        liq = liquidacionRepository.save(liq);
        return LiquidacionResponse.from(liq);
    }

    @Transactional
    public LiquidacionResponse cerrar(Long id, CierreLiquidacionRequest req, Long cajeroId) {
        LiquidacionRepartidor liq = liquidacionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));

        if (liq.getEstado() == EstadoLiquidacion.CERRADA || liq.getEstado() == EstadoLiquidacion.DISCREPANCIA) {
            throw new IllegalStateException("La liquidación #" + id + " ya fue cerrada anteriormente (estado: " + liq.getEstado() + ").");
        }

        BigDecimal totalCobrado = req.totalCobradoEfectivo() != null
                ? req.totalCobradoEfectivo()
                : liq.getTotalCobradoEfectivo();

        BigDecimal esperado = liq.getFondoInicial().add(totalCobrado);
        BigDecimal diferencia = req.totalRendido().subtract(esperado);

        liq.setTotalCobradoEfectivo(totalCobrado);
        liq.setTotalRendido(req.totalRendido());
        liq.setDiferencia(diferencia);
        liq.setEstado(diferencia.compareTo(BigDecimal.ZERO) == 0 ? EstadoLiquidacion.CERRADA : EstadoLiquidacion.DISCREPANCIA);
        if (req.observaciones() != null) {
            liq.setObservaciones((liq.getObservaciones() != null ? liq.getObservaciones() + " | " : "") + req.observaciones());
        }
        liq.setCerradoEn(LocalDateTime.now());
        liq.setCerradoPor(cajeroId);

        liq = liquidacionRepository.save(liq);

        // Registrar ingreso del efectivo total rendido en la caja activa del cajero
        var arqueoOpt = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
        if (arqueoOpt.isPresent() && req.totalRendido().compareTo(BigDecimal.ZERO) > 0) {
            MovimientoCaja ingreso = MovimientoCaja.builder()
                    .arqueoId(arqueoOpt.get().getId())
                    .tipo(TipoMovimiento.INGRESO)
                    .monto(req.totalRendido())
                    .motivo("Rendición y liquidación de repartidor " + liq.getRepartidorNombre() + " (Liq #" + liq.getId() + ")")
                    .registradoPor(cajeroId)
                    .fecha(LocalDateTime.now())
                    .build();
            movimientoRepository.save(ingreso);
        }

        log.info("Liquidación #{} cerrada: Rendido S/ {}, Esperado S/ {}, Diferencia S/ {} (Estado: {})",
                liq.getId(), req.totalRendido(), esperado, diferencia, liq.getEstado());

        return LiquidacionResponse.from(liq);
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listarPorRepartidor(Long repartidorId) {
        return liquidacionRepository.findByRepartidorIdOrderByCreadoEnDesc(repartidorId)
                .stream().map(LiquidacionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listarAbiertas() {
        return liquidacionRepository.findByEstadoOrderByCreadoEnDesc(EstadoLiquidacion.ABIERTA)
                .stream().map(LiquidacionResponse::from).toList();
    }
}
