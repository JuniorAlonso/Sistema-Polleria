package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.*;
import com.sistema.polleria.finance.entity.*;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.CobroRepartidorRepository;
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
    private final CobroRepartidorRepository cobroRepartidorRepository;
    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final PagosClient pagosClient;

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
    public LiquidacionResponse recargarFondo(Long id, RecargaFondoRequest req, Long cajeroId) {
        LiquidacionRepartidor liq = liquidacionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));

        if (liq.getEstado() != EstadoLiquidacion.ABIERTA) {
            throw new IllegalStateException("Solo se puede recargar fondo a una liquidación ABIERTA (estado actual: " + liq.getEstado() + ")");
        }

        if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto a recargar debe ser mayor a 0");
        }

        var arqueoOpt = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
        if (arqueoOpt.isEmpty()) {
            throw new IllegalStateException("No hay caja abierta para registrar el egreso de efectivo");
        }

        BigDecimal fondoPrevio = liq.getFondoInicial() != null ? liq.getFondoInicial() : BigDecimal.ZERO;
        BigDecimal nuevoFondo = fondoPrevio.add(req.monto());
        liq.setFondoInicial(nuevoFondo);
        if (req.motivo() != null && !req.motivo().isBlank()) {
            String obs = liq.getObservaciones() != null ? liq.getObservaciones() + " | " : "";
            liq.setObservaciones(obs + "Recarga fondo S/ " + req.monto() + ": " + req.motivo());
        }
        liq = liquidacionRepository.save(liq);

        String motivoEgreso = "Recarga de fondo de vueltos a repartidor " + liq.getRepartidorNombre()
                + " (Liq #" + liq.getId() + ")"
                + (req.motivo() != null && !req.motivo().isBlank() ? ": " + req.motivo() : "");

        MovimientoCaja egreso = MovimientoCaja.builder()
                .arqueoId(arqueoOpt.get().getId())
                .tipo(TipoMovimiento.EGRESO)
                .monto(req.monto())
                .motivo(motivoEgreso)
                .registradoPor(cajeroId)
                .fecha(LocalDateTime.now())
                .build();
        movimientoRepository.save(egreso);

        log.info("Recarga de fondo S/ {} aplicada a liquidación #{} del repartidor {}. Fondo acumulado: S/ {}",
                req.monto(), liq.getId(), liq.getRepartidorNombre(), nuevoFondo);

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
    public LiquidacionResponse cerrar(Long id, CierreLiquidacionRequest req, Long cajeroId, String bearer) {
        LiquidacionRepartidor liq = liquidacionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));

        if (liq.getEstado() == EstadoLiquidacion.CERRADA || liq.getEstado() == EstadoLiquidacion.DISCREPANCIA) {
            throw new IllegalStateException("La liquidación #" + id + " ya fue cerrada anteriormente (estado: " + liq.getEstado() + ").");
        }

        // S6/S8: expected cash is every cash payment of the courier not yet linked to a settlement, with no
        // time cutoff (payments-service already excludes linked payments); fail closed if unreachable.
        PagosClient.EfectivoPendiente pendiente =
                pagosClient.obtenerPendiente(liq.getRepartidorId(), null, bearer);
        BigDecimal totalEsperadoEfectivo = pendiente.total() != null ? pendiente.total() : BigDecimal.ZERO;

        BigDecimal totalCobrado = req.totalCobradoEfectivo() != null
                ? req.totalCobradoEfectivo()
                : liq.getTotalCobradoEfectivo();

        // S8: the courier must hand in the float plus the cash payments recorded, not the cashier-typed total.
        BigDecimal esperado = liq.getFondoInicial().add(totalEsperadoEfectivo);
        BigDecimal diferencia = req.totalRendido().subtract(esperado);

        // Prevenir duplicación en caja: descontar cobros parciales que ya ingresaron a caja chica
        BigDecimal totalRendidoPrevio = cobroRepartidorRepository.sumMontoByLiquidacionId(liq.getId());
        if (totalRendidoPrevio == null) totalRendidoPrevio = BigDecimal.ZERO;
        BigDecimal incrementalCierre = req.totalRendido().subtract(totalRendidoPrevio);

        liq.setTotalCobradoEfectivo(totalCobrado);
        liq.setTotalEsperadoEfectivo(totalEsperadoEfectivo);
        liq.setDiferenciaEfectivo(totalCobrado.subtract(totalEsperadoEfectivo));
        liq.setTotalRendido(req.totalRendido());
        liq.setDiferencia(diferencia);
        liq.setEstado(diferencia.compareTo(BigDecimal.ZERO) == 0 ? EstadoLiquidacion.CERRADA : EstadoLiquidacion.DISCREPANCIA);
        if (req.observaciones() != null) {
            liq.setObservaciones((liq.getObservaciones() != null ? liq.getObservaciones() + " | " : "") + req.observaciones());
        }
        liq.setCerradoEn(LocalDateTime.now());
        liq.setCerradoPor(cajeroId);

        liq = liquidacionRepository.save(liq);

        if (pendiente.pagos() != null && !pendiente.pagos().isEmpty()) {
            pagosClient.liquidar(pendiente.pagos().stream().map(PagosClient.EfectivoPendiente.Item::pagoId).toList(),
                    liq.getId(), bearer);
        }

        // Registrar ingreso del remanente efectivo en la caja activa del cajero (solo el incremental para no duplicar)
        var arqueoOpt = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
        if (arqueoOpt.isPresent() && incrementalCierre.compareTo(BigDecimal.ZERO) > 0) {
            MovimientoCaja ingreso = MovimientoCaja.builder()
                    .arqueoId(arqueoOpt.get().getId())
                    .tipo(TipoMovimiento.INGRESO)
                    .monto(incrementalCierre)
                    .motivo("Rendición y liquidación de repartidor " + liq.getRepartidorNombre() + " (Liq #" + liq.getId() + ")")
                    .registradoPor(cajeroId)
                    .fecha(LocalDateTime.now())
                    .build();
            movimientoRepository.save(ingreso);

            // Registrar también en el libro mayor de cobros a repartidores
            CobroRepartidor cobroCierre = CobroRepartidor.builder()
                    .repartidorId(liq.getRepartidorId())
                    .monto(incrementalCierre)
                    .arqueoCajaId(arqueoOpt.get().getId())
                    .cobradoPor(cajeroId)
                    .fecha(LocalDateTime.now())
                    .observaciones("Cierre y liquidación final (Liq #" + liq.getId() + ")")
                    .liquidacionId(liq.getId())
                    .build();
            cobroRepartidorRepository.save(cobroCierre);
        }

        log.info("Liquidación #{} cerrada: Rendido S/ {}, Esperado S/ {}, Diferencia S/ {} (Estado: {})",
                liq.getId(), req.totalRendido(), esperado, diferencia, liq.getEstado());

        return LiquidacionResponse.from(liq);
    }

    /**
     * Cash a courier must hand in: expected cash (orders + float) minus any cash already collected
     * by cashier/admin via partial/total collections (S6, S8).
     */
    @Transactional(readOnly = true)
    public EfectivoPendienteLiquidacionResponse efectivoPendiente(Long repartidorId, String bearer) {
        var liqOpt = liquidacionRepository
                .findFirstByRepartidorIdAndEstado(repartidorId, EstadoLiquidacion.ABIERTA);

        PagosClient.EfectivoPendiente p = pagosClient.obtenerPendiente(repartidorId, null, bearer);
        BigDecimal totalCobrado = p.total() != null ? p.total() : BigDecimal.ZERO;

        BigDecimal totalRendido = liqOpt
                .map(l -> cobroRepartidorRepository.sumMontoByLiquidacionId(l.getId()))
                .orElse(BigDecimal.ZERO);
        if (totalRendido == null) totalRendido = BigDecimal.ZERO;

        BigDecimal fondo = liqOpt
                .map(l -> l.getFondoInicial() != null ? l.getFondoInicial() : BigDecimal.ZERO)
                .orElse(BigDecimal.ZERO);
        BigDecimal saldoPendiente = fondo.add(totalCobrado).subtract(totalRendido);
        if (saldoPendiente.compareTo(BigDecimal.ZERO) < 0) {
            saldoPendiente = BigDecimal.ZERO;
        }

        Long liqId = liqOpt.map(LiquidacionRepartidor::getId).orElse(null);
        LocalDateTime creadoEn = liqOpt.map(LiquidacionRepartidor::getCreadoEn).orElse(null);

        return new EfectivoPendienteLiquidacionResponse(
                repartidorId, liqId, creadoEn,
                saldoPendiente, p.cantidad(),
                p.pagos() != null ? p.pagos() : List.of(),
                totalCobrado, totalRendido);
    }

    /**
     * Cobro de efectivo (parcial monto X o total) a un repartidor por parte de ADMIN o CAJERO.
     * Solo a través de este método el efectivo a rendir disminuye.
     */
    @Transactional
    public CobroRepartidorResponse registrarCobro(RegistrarCobroRepartidorRequest req, Long operadorId, String bearer) {
        // 1. Obtener o crear la liquidación abierta para este repartidor
        LiquidacionRepartidor liq = liquidacionRepository
                .findFirstByRepartidorIdAndEstado(req.repartidorId(), EstadoLiquidacion.ABIERTA)
                .orElseGet(() -> {
                    String nombre = req.repartidorNombre() != null && !req.repartidorNombre().isBlank()
                            ? req.repartidorNombre()
                            : "Repartidor #" + req.repartidorId();
                    var arqueoActivo = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
                    LiquidacionRepartidor nueva = LiquidacionRepartidor.builder()
                            .repartidorId(req.repartidorId())
                            .repartidorNombre(nombre)
                            .arqueoCajaId(arqueoActivo.map(ArqueoCaja::getId).orElse(null))
                            .fondoInicial(BigDecimal.ZERO)
                            .totalCobradoEfectivo(BigDecimal.ZERO)
                            .totalRendido(BigDecimal.ZERO)
                            .diferencia(BigDecimal.ZERO)
                            .estado(EstadoLiquidacion.ABIERTA)
                            .observaciones("Liquidación abierta automáticamente por cobro de efectivo")
                            .creadoEn(LocalDateTime.now())
                            .build();
                    return liquidacionRepository.save(nueva);
                });

        // 2. Consultar pagos pendientes en payments-service
        PagosClient.EfectivoPendiente pendiente = pagosClient.obtenerPendiente(req.repartidorId(), null, bearer);
        BigDecimal totalCobrado = pendiente.total() != null ? pendiente.total() : BigDecimal.ZERO;
        liq.setTotalCobradoEfectivo(totalCobrado);

        // 3. Consultar cuánto ya ha rendido en cobros previos de esta liquidación
        BigDecimal totalRendidoPrevio = cobroRepartidorRepository.sumMontoByLiquidacionId(liq.getId());
        if (totalRendidoPrevio == null) totalRendidoPrevio = BigDecimal.ZERO;

        BigDecimal totalEsperado = liq.getFondoInicial().add(totalCobrado);
        BigDecimal saldoPendiente = totalEsperado.subtract(totalRendidoPrevio);
        if (saldoPendiente.compareTo(BigDecimal.ZERO) < 0) saldoPendiente = BigDecimal.ZERO;

        if (req.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto a cobrar debe ser mayor a 0");
        }
        if (req.monto().compareTo(saldoPendiente) > 0) {
            throw new IllegalArgumentException("El monto a cobrar (S/ " + req.monto()
                    + ") supera el saldo pendiente (S/ " + saldoPendiente + ")");
        }

        // 4. Buscar arqueo activo para registrar el ingreso a caja física
        var arqueoOpt = arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
        Long arqueoId = arqueoOpt.map(ArqueoCaja::getId).orElse(null);

        // 5. Guardar el cobro
        CobroRepartidor cobro = CobroRepartidor.builder()
                .repartidorId(req.repartidorId())
                .monto(req.monto())
                .arqueoCajaId(arqueoId)
                .cobradoPor(operadorId)
                .fecha(LocalDateTime.now())
                .observaciones(req.observaciones())
                .liquidacionId(liq.getId())
                .build();
        cobro = cobroRepartidorRepository.save(cobro);

        // 6. Si hay caja abierta, registrar movimiento de INGRESO
        if (arqueoOpt.isPresent()) {
            MovimientoCaja ingreso = MovimientoCaja.builder()
                    .arqueoId(arqueoOpt.get().getId())
                    .tipo(TipoMovimiento.INGRESO)
                    .monto(req.monto())
                    .motivo("Cobro de efectivo a repartidor " + liq.getRepartidorNombre() + " (Cobro #" + cobro.getId() + ")")
                    .registradoPor(operadorId)
                    .fecha(LocalDateTime.now())
                    .build();
            movimientoRepository.save(ingreso);
        }

        // 7. Actualizar la liquidación
        BigDecimal nuevoTotalRendido = totalRendidoPrevio.add(req.monto());
        liq.setTotalRendido(nuevoTotalRendido);
        BigDecimal saldoRestante = saldoPendiente.subtract(req.monto());

        // Si el saldo llega a 0, liquidamos los pagos pendientes en payments-service y cerramos
        if (saldoRestante.compareTo(BigDecimal.ZERO) == 0) {
            if (pendiente.pagos() != null && !pendiente.pagos().isEmpty()) {
                pagosClient.liquidar(
                        pendiente.pagos().stream().map(PagosClient.EfectivoPendiente.Item::pagoId).toList(),
                        liq.getId(),
                        bearer
                );
            }
            liq.setTotalEsperadoEfectivo(totalCobrado);
            liq.setDiferenciaEfectivo(BigDecimal.ZERO);
            liq.setDiferencia(BigDecimal.ZERO);
            liq.setEstado(EstadoLiquidacion.CERRADA);
            liq.setCerradoEn(LocalDateTime.now());
            liq.setCerradoPor(operadorId);
        }
        liquidacionRepository.save(liq);

        log.info("Cobro #{} registrado: S/ {} al repartidor {} (Saldo restante: S/ {})",
                cobro.getId(), req.monto(), liq.getRepartidorNombre(), saldoRestante);

        return CobroRepartidorResponse.from(cobro, saldoRestante);
    }

    @Transactional(readOnly = true)
    public List<CobroRepartidorResponse> listarCobrosPorRepartidor(Long repartidorId) {
        return cobroRepartidorRepository.findByRepartidorIdOrderByFechaDesc(repartidorId)
                .stream()
                .map(c -> CobroRepartidorResponse.from(c, BigDecimal.ZERO))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RepartidorPendienteCobroResponse> listarRepartidoresConPendiente(String bearer) {
        List<LiquidacionRepartidor> abiertas = liquidacionRepository.findByEstadoOrderByCreadoEnDesc(EstadoLiquidacion.ABIERTA);
        return abiertas.stream().map(l -> {
            EfectivoPendienteLiquidacionResponse pend = efectivoPendiente(l.getRepartidorId(), bearer);
            return new RepartidorPendienteCobroResponse(
                    l.getRepartidorId(),
                    l.getRepartidorNombre(),
                    pend.totalCobrado(),
                    pend.totalRendido(),
                    pend.total(),
                    pend.cantidad(),
                    l.getId()
            );
        }).toList();
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
