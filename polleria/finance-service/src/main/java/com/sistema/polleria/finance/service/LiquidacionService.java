package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.*;
import com.sistema.polleria.finance.entity.*;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.CobroRepartidorRepository;
import com.sistema.polleria.finance.repository.LiquidacionRepartidorRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiquidacionService {

    private final LiquidacionRepartidorRepository liquidacionRepository;
    private final CobroRepartidorRepository cobroRepartidorRepository;
    private final ArqueoCajaRepository arqueoRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final PagosClient pagosClient;

    @Autowired(required = false)
    private PlatformTransactionManager transactionManager;

    private record ResultadoCierre(LiquidacionResponse response, Long liqId, List<Long> pagoIds) {
    }

    private record ResultadoCobro(CobroRepartidorResponse response, Long liqId, List<Long> pagoIds) {
    }

    @Transactional
    public LiquidacionResponse abrir(AperturaLiquidacionRequest req, Long cajeroId) {
        // Verificar si el repartidor ya tiene una liquidación abierta con bloqueo pesimista
        liquidacionRepository.findFirstWithLockByRepartidorIdAndEstado(req.repartidorId(), EstadoLiquidacion.ABIERTA)
                .ifPresent(l -> {
                    throw new IllegalStateException("El repartidor " + req.repartidorNombre()
                            + " ya tiene una liquidación abierta (ID #" + l.getId() + ")");
                });

        var arqueoOpt = arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);

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

        try {
            liq = liquidacionRepository.save(liq);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("El repartidor " + req.repartidorNombre()
                    + " ya tiene una liquidación abierta.", e);
        }

        // Si se entregó fondo inicial desde la caja chica, registrar movimiento de egreso
        if (arqueoOpt.isPresent() && req.fondoInicial().compareTo(BigDecimal.ZERO) > 0) {
            MovimientoCaja egreso = MovimientoCaja.builder()
                    .arqueoId(arqueoOpt.get().getId())
                    .tipo(TipoMovimiento.EGRESO)
                    .categoria(CategoriaMovimiento.FONDO_REPARTIDOR)
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
        LiquidacionRepartidor liq = liquidacionRepository.findByIdParaActualizar(id)
                .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));

        if (liq.getEstado() != EstadoLiquidacion.ABIERTA) {
            throw new IllegalStateException("Solo se puede recargar fondo a una liquidación ABIERTA (estado actual: " + liq.getEstado() + ")");
        }

        if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto a recargar debe ser mayor a 0");
        }

        var arqueoOpt = arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA);
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
                    .categoria(CategoriaMovimiento.FONDO_REPARTIDOR)
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
        LiquidacionRepartidor liq = liquidacionRepository
                .findFirstWithLockByRepartidorIdAndEstado(repartidorId, EstadoLiquidacion.ABIERTA)
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

        try {
            liq = liquidacionRepository.save(liq);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalStateException("Ya existe una liquidación abierta concurrente para el repartidor #" + repartidorId, e);
        }
        return LiquidacionResponse.from(liq);
    }

    public LiquidacionResponse cerrar(Long id, CierreLiquidacionRequest req, Long cajeroId, String bearer) {
        Long repartidorId = ejecutarEnTransaccion(() -> {
            LiquidacionRepartidor liq = liquidacionRepository.findByIdParaActualizar(id)
                    .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));
            if (liq.getEstado() == EstadoLiquidacion.CERRADA || liq.getEstado() == EstadoLiquidacion.DISCREPANCIA) {
                throw new IllegalStateException("La liquidación #" + id + " ya fue cerrada anteriormente (estado: " + liq.getEstado() + ").");
            }
            exigirCajaAbierta();
            return liq.getRepartidorId();
        });

        // HTTP read runs outside DB transactions and row locks; fail closed if unreachable.
        PagosClient.EfectivoPendiente pendiente = pagosClient.obtenerPendiente(repartidorId, null, bearer);

        ResultadoCierre resultado = ejecutarEnTransaccion(() -> {
            LiquidacionRepartidor liq = liquidacionRepository.findByIdParaActualizar(id)
                    .orElseThrow(() -> new NoSuchElementException("Liquidación no encontrada: " + id));
            if (liq.getEstado() == EstadoLiquidacion.CERRADA || liq.getEstado() == EstadoLiquidacion.DISCREPANCIA) {
                throw new IllegalStateException("La liquidación #" + id + " ya fue cerrada anteriormente (estado: " + liq.getEstado() + ").");
            }
            ArqueoCaja caja = exigirCajaAbierta();

            BigDecimal totalEsperadoEfectivo = pendiente.total() != null ? pendiente.total() : BigDecimal.ZERO;
            BigDecimal totalCobrado = req.totalCobradoEfectivo() != null
                    ? req.totalCobradoEfectivo()
                    : liq.getTotalCobradoEfectivo();

            // The courier must hand in the float plus the cash payments recorded, not the cashier-typed total.
            BigDecimal esperado = liq.getFondoInicial().add(totalEsperadoEfectivo);
            BigDecimal diferencia = req.totalRendido().subtract(esperado);

            BigDecimal totalRendidoPrevio = cobroRepartidorRepository.sumMontoByLiquidacionId(liq.getId());
            if (totalRendidoPrevio == null) totalRendidoPrevio = BigDecimal.ZERO;
            BigDecimal incrementalCierre = req.totalRendido().subtract(totalRendidoPrevio);

            List<Long> pagoIds = pendiente.pagos() != null
                    ? pendiente.pagos().stream().map(PagosClient.EfectivoPendiente.Item::pagoId).toList()
                    : List.of();

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
            if (!pagoIds.isEmpty()) {
                liq.setPagosPendientesLiquidar(serializarIds(pagoIds));
            }

            liq = liquidacionRepository.save(liq);

            if (incrementalCierre.compareTo(BigDecimal.ZERO) > 0) {
                registrarIngresoRepartidor(liq, caja, incrementalCierre, totalRendidoPrevio,
                        "Rendición y liquidación de repartidor " + liq.getRepartidorNombre() + " (Liq #" + liq.getId() + ")",
                        cajeroId);

                CobroRepartidor cobroCierre = CobroRepartidor.builder()
                        .repartidorId(liq.getRepartidorId())
                        .monto(incrementalCierre)
                        .arqueoCajaId(caja.getId())
                        .cobradoPor(cajeroId)
                        .fecha(LocalDateTime.now())
                        .observaciones("Cierre y liquidación final (Liq #" + liq.getId() + ")")
                        .liquidacionId(liq.getId())
                        .build();
                cobroRepartidorRepository.save(cobroCierre);
            }

            log.info("Liquidación #{} cerrada: Rendido S/ {}, Esperado S/ {}, Diferencia S/ {} (Estado: {})",
                    liq.getId(), req.totalRendido(), esperado, diferencia, liq.getEstado());

            return new ResultadoCierre(LiquidacionResponse.from(liq), liq.getId(), pagoIds);
        });

        if (!resultado.pagoIds().isEmpty()) {
            sincronizarPagosTrasCommit(resultado.liqId(), resultado.pagoIds(), bearer);
        }
        return resultado.response();
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
    public CobroRepartidorResponse registrarCobro(RegistrarCobroRepartidorRequest req, Long operadorId, String bearer) {
        if (req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto a cobrar debe ser mayor a 0");
        }
        ejecutarEnTransaccion(() -> {
            exigirCajaAbierta();
            return null;
        });

        // HTTP read runs outside DB transactions and row locks.
        PagosClient.EfectivoPendiente pendiente = pagosClient.obtenerPendiente(req.repartidorId(), null, bearer);

        ResultadoCobro resultado = ejecutarEnTransaccion(() -> {
            ArqueoCaja caja = exigirCajaAbierta();
            LiquidacionRepartidor liq = liquidacionRepository
                    .findFirstWithLockByRepartidorIdAndEstado(req.repartidorId(), EstadoLiquidacion.ABIERTA)
                    .orElseGet(() -> {
                        String nombre = req.repartidorNombre() != null && !req.repartidorNombre().isBlank()
                                ? req.repartidorNombre()
                                : "Repartidor #" + req.repartidorId();
                        LiquidacionRepartidor nueva = LiquidacionRepartidor.builder()
                                .repartidorId(req.repartidorId())
                                .repartidorNombre(nombre)
                                .arqueoCajaId(caja.getId())
                                .fondoInicial(BigDecimal.ZERO)
                                .totalCobradoEfectivo(BigDecimal.ZERO)
                                .totalRendido(BigDecimal.ZERO)
                                .diferencia(BigDecimal.ZERO)
                                .estado(EstadoLiquidacion.ABIERTA)
                                .observaciones("Liquidación abierta automáticamente por cobro de efectivo")
                                .creadoEn(LocalDateTime.now())
                                .build();
                        try {
                            return liquidacionRepository.save(nueva);
                        } catch (DataIntegrityViolationException e) {
                            throw new IllegalStateException("Ya existe una liquidación abierta concurrente para este repartidor. Reintenta.", e);
                        }
                    });

            BigDecimal totalCobrado = pendiente.total() != null ? pendiente.total() : BigDecimal.ZERO;
            liq.setTotalCobradoEfectivo(totalCobrado);

            BigDecimal totalRendidoPrevio = cobroRepartidorRepository.sumMontoByLiquidacionId(liq.getId());
            if (totalRendidoPrevio == null) totalRendidoPrevio = BigDecimal.ZERO;

            BigDecimal totalEsperado = liq.getFondoInicial().add(totalCobrado);
            BigDecimal saldoPendiente = totalEsperado.subtract(totalRendidoPrevio);
            if (saldoPendiente.compareTo(BigDecimal.ZERO) < 0) saldoPendiente = BigDecimal.ZERO;

            if (req.monto().compareTo(saldoPendiente) > 0) {
                throw new IllegalArgumentException("El monto a cobrar (S/ " + req.monto()
                        + ") supera el saldo pendiente (S/ " + saldoPendiente + ")");
            }

            Long arqueoId = caja.getId();

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

            registrarIngresoRepartidor(liq, caja, req.monto(), totalRendidoPrevio,
                    "Cobro de efectivo a repartidor " + liq.getRepartidorNombre() + " (Cobro #" + cobro.getId() + ")",
                    operadorId);

            BigDecimal nuevoTotalRendido = totalRendidoPrevio.add(req.monto());
            liq.setTotalRendido(nuevoTotalRendido);
            BigDecimal saldoRestante = saldoPendiente.subtract(req.monto());

            List<Long> pagoIds = List.of();
            if (saldoRestante.compareTo(BigDecimal.ZERO) == 0) {
                if (pendiente.pagos() != null && !pendiente.pagos().isEmpty()) {
                    pagoIds = pendiente.pagos().stream().map(PagosClient.EfectivoPendiente.Item::pagoId).toList();
                    liq.setPagosPendientesLiquidar(serializarIds(pagoIds));
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

            return new ResultadoCobro(CobroRepartidorResponse.from(cobro, saldoRestante), liq.getId(), pagoIds);
        });

        if (!resultado.pagoIds().isEmpty()) {
            sincronizarPagosTrasCommit(resultado.liqId(), resultado.pagoIds(), bearer);
        }
        return resultado.response();
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
        return liquidacionRepository.findByRepartidorIdOrderByCreadoEnDesc(repartidorId, PageRequest.of(0, 500))
                .stream().map(LiquidacionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<LiquidacionResponse> listarAbiertas() {
        return liquidacionRepository.findByEstadoOrderByCreadoEnDesc(EstadoLiquidacion.ABIERTA, PageRequest.of(0, 500))
                .stream().map(LiquidacionResponse::from).toList();
    }

    @Scheduled(fixedDelay = 30000)
    public void reintentarSincronizacionesPendientes() {
        List<LiquidacionRepartidor> pendientes = liquidacionRepository.findByPagosPendientesLiquidarIsNotNull();
        for (LiquidacionRepartidor liq : pendientes) {
            List<Long> ids = deserializarIds(liq.getPagosPendientesLiquidar());
            if (ids.isEmpty()) {
                ejecutarEnTransaccion(() -> {
                    liquidacionRepository.limpiarPagosPendientes(liq.getId());
                    return null;
                });
                continue;
            }
            sincronizarPagosTrasCommit(liq.getId(), ids, null);
        }
    }

    private void sincronizarPagosTrasCommit(Long liqId, List<Long> pagoIds, String bearer) {
        int maxIntentos = 3;
        for (int intento = 1; intento <= maxIntentos; intento++) {
            try {
                pagosClient.liquidar(pagoIds, liqId, bearer);
                ejecutarEnTransaccion(() -> {
                    liquidacionRepository.limpiarPagosPendientes(liqId);
                    return null;
                });
                return;
            } catch (PagosClient.PagosNoDisponibleException e) {
                log.warn("Intento {}/{} de sincronizar cobros liquidados para liq #{} falló: {}",
                        intento, maxIntentos, liqId, e.getMessage());
                if (intento == maxIntentos) {
                    log.error("Liquidación #{} cerrada en finanzas; sincronización pendiente en payments-service para pagos {}",
                            liqId, pagoIds);
                }
            } catch (IllegalStateException e) {
                log.error("Conflicto al sincronizar pagos {} de liq #{}: {}", pagoIds, liqId, e.getMessage());
                return;
            }
        }
    }

    private static String serializarIds(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private static List<Long> deserializarIds(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::valueOf)
                .toList();
    }

    private <T> T ejecutarEnTransaccion(Supplier<T> accion) {
        if (transactionManager == null) {
            return accion.get();
        }
        return new TransactionTemplate(transactionManager).execute(status -> accion.get());
    }

    private ArqueoCaja exigirCajaAbierta() {
        return arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)
                .orElseThrow(() -> new IllegalStateException(
                        "No hay una caja abierta: abre la caja antes de recibir efectivo del repartidor"));
    }

    /**
     * Cash a courier hands in returns the change float first and only the rest is sales cash, so the
     * daily report counts neither the float as a sale nor its handover as an expense (R3.10). The
     * drawer total is the same as one single movement.
     */
    private void registrarIngresoRepartidor(LiquidacionRepartidor liq, ArqueoCaja caja, BigDecimal monto,
                                            BigDecimal rendidoPrevio, String motivo, Long usuarioId) {
        BigDecimal fondo = liq.getFondoInicial() != null ? liq.getFondoInicial() : BigDecimal.ZERO;
        BigDecimal fondoPorDevolver = fondo.subtract(rendidoPrevio).max(BigDecimal.ZERO);
        BigDecimal parteFondo = monto.min(fondoPorDevolver);
        BigDecimal parteVentas = monto.subtract(parteFondo);
        if (parteFondo.signum() > 0) {
            movimientoRepository.save(ingreso(caja, parteFondo, CategoriaMovimiento.FONDO_REPARTIDOR,
                    "Devolución de fondo de vueltos · " + motivo, usuarioId));
        }
        if (parteVentas.signum() > 0) {
            movimientoRepository.save(ingreso(caja, parteVentas, CategoriaMovimiento.RENDICION_REPARTIDOR, motivo, usuarioId));
        }
    }

    private static MovimientoCaja ingreso(ArqueoCaja caja, BigDecimal monto, CategoriaMovimiento categoria,
                                          String motivo, Long usuarioId) {
        return MovimientoCaja.builder()
                .arqueoId(caja.getId())
                .tipo(TipoMovimiento.INGRESO)
                .categoria(categoria)
                .monto(monto)
                .motivo(motivo.length() > 255 ? motivo.substring(0, 255) : motivo)
                .registradoPor(usuarioId)
                .fecha(LocalDateTime.now())
                .build();
    }
}
