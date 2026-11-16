package com.sistema.polleria.feedback.service;

import com.sistema.polleria.feedback.dto.CrearReporteRequest;
import com.sistema.polleria.feedback.dto.ReporteResponse;
import com.sistema.polleria.feedback.dto.ResolverReporteRequest;
import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import com.sistema.polleria.feedback.repository.ReporteIncidenciaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReporteIncidenciaService {

    private static final int LIMITE_LISTADO_ADMIN = 500;

    private final ReporteIncidenciaRepository reporteRepository;
    private final FileStorageService fileStorageService;
    private final PaymentsClient paymentsClient;
    private final OrdersClient ordersClient;
    private final FinanceClient financeClient;

    @Autowired(required = false)
    private PlatformTransactionManager transactionManager;

    public ReporteResponse crear(CrearReporteRequest request, MultipartFile foto, Long clienteId) {
        // Fail-closed: validar contra orders-service y subir evidencia fuera de la transacción BD (CON-03)
        ordersClient.obtenerYValidarOrden(request.getOrdenId(), clienteId, false);

        String fotoUrl = request.getFotoEvidenciaUrl();
        if (foto != null && !foto.isEmpty()) {
            fotoUrl = fileStorageService.guardarArchivo(foto);
        }
        final String evidenciaFinal = fotoUrl;

        ReporteIncidencia guardado = ejecutarEnTransaccion(() -> {
            if (reporteRepository.existsByOrdenId(request.getOrdenId())) {
                throw new IllegalStateException(
                        "Ya existe un reclamo registrado para la orden #" + request.getOrdenId());
            }

            ReporteIncidencia reporte = ReporteIncidencia.builder()
                    .ordenId(request.getOrdenId())
                    .clienteId(clienteId)
                    .motivo(request.getMotivo())
                    .descripcion(request.getDescripcion())
                    .fotoEvidenciaUrl(evidenciaFinal)
                    .estado(EstadoReclamo.ABIERTO)
                    .reembolsoProcedente(false)
                    .reembolsoEnProceso(false)
                    .entregaEnProceso(false)
                    .build();

            try {
                return reporteRepository.save(reporte);
            } catch (DataIntegrityViolationException e) {
                throw new IllegalStateException(
                        "Ya existe un reclamo registrado para la orden #" + request.getOrdenId());
            }
        });

        log.info("Reporte #{} creado para orden #{} por cliente #{}", guardado.getId(), guardado.getOrdenId(), clienteId);
        return ReporteResponse.from(guardado);
    }

    public List<ReporteResponse> listarPorCliente(Long clienteId) {
        return reporteRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(ReporteResponse::from).toList();
    }

    public List<ReporteResponse> listarAdmin(EstadoReclamo estado, MotivoReclamo motivo) {
        var pagina = PageRequest.of(0, LIMITE_LISTADO_ADMIN);
        if (estado != null && motivo != null) {
            return reporteRepository.findByEstadoAndMotivoOrderByCreadoEnDesc(estado, motivo, pagina)
                    .stream().map(ReporteResponse::from).toList();
        } else if (estado != null) {
            return reporteRepository.findByEstadoOrderByCreadoEnDesc(estado, pagina)
                    .stream().map(ReporteResponse::from).toList();
        } else if (motivo != null) {
            return reporteRepository.findByMotivoOrderByCreadoEnDesc(motivo, pagina)
                    .stream().map(ReporteResponse::from).toList();
        }
        return reporteRepository.findAllByOrderByCreadoEnDesc(pagina)
                .stream().map(ReporteResponse::from).toList();
    }

    public ReporteResponse obtenerPorIdSeguro(Long id, Long solicitanteId, boolean esAdmin) {
        ReporteIncidencia reporte = buscarOFallar(id);
        if (!esAdmin && !reporte.getClienteId().equals(solicitanteId)) {
            throw new AccessDeniedException("No tiene permisos para acceder a este reporte");
        }
        return ReporteResponse.from(reporte);
    }

    public ReporteResponse obtenerPorId(Long id) {
        return ReporteResponse.from(buscarOFallar(id));
    }

    public java.util.Optional<ReporteResponse> obtenerPorOrden(Long ordenId, Long solicitanteId, boolean esAdmin) {
        return reporteRepository.findFirstByOrdenIdOrderByCreadoEnDesc(ordenId)
                .filter(r -> esAdmin || r.getClienteId().equals(solicitanteId))
                .map(ReporteResponse::from);
    }

    public ReporteResponse cambiarEstado(Long id, EstadoReclamo nuevoEstado) {
        return ejecutarEnTransaccion(() -> {
            ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
            if (reporte.getEstado() == EstadoReclamo.RESUELTO || reporte.getEstado() == EstadoReclamo.RECHAZADO) {
                throw new IllegalStateException(
                        "El reporte #" + id + " ya está en estado terminal " + reporte.getEstado() + " y no puede modificarse");
            }
            reporte.setEstado(nuevoEstado);
            if (nuevoEstado == EstadoReclamo.RESUELTO || nuevoEstado == EstadoReclamo.RECHAZADO) {
                reporte.setResueltoEn(LocalDateTime.now());
            }
            ReporteIncidencia guardado = reporteRepository.save(reporte);
            log.info("Reporte #{} movido a estado {}", id, nuevoEstado);
            return ReporteResponse.from(guardado);
        });
    }

    public ReporteResponse resolver(Long id, ResolverReporteRequest request, String bearerToken) {
        boolean conReembolso = Boolean.TRUE.equals(request.getReembolsoProcedente());
        if (conReembolso) {
            if (request.getMontoReembolso() == null || request.getMontoReembolso().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("El monto de reembolso debe ser mayor a cero");
            }
            ReporteIncidencia lecturaPrevia = buscarOFallar(id);
            if (lecturaPrevia.getEstado() == EstadoReclamo.RESUELTO || lecturaPrevia.getEstado() == EstadoReclamo.RECHAZADO) {
                throw new IllegalStateException("El reporte #" + id + " ya fue resuelto con anterioridad");
            }
            // DIN-05 & CON-03: validar monto contra el total de la orden fuera de la transacción BD
            Map<String, Object> orden = ordersClient.obtenerYValidarOrden(lecturaPrevia.getOrdenId(), null, true);
            BigDecimal totalOrden = extraerTotalOrden(orden);
            if (totalOrden != null && request.getMontoReembolso().compareTo(totalOrden) > 0) {
                throw new IllegalArgumentException(
                        "El monto de reembolso (S/ " + request.getMontoReembolso()
                                + ") excede el total de la orden (S/ " + totalOrden + ")");
            }

            Long ordenId = ejecutarEnTransaccion(() -> {
                ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
                if (reporte.getEstado() == EstadoReclamo.RESUELTO || reporte.getEstado() == EstadoReclamo.RECHAZADO) {
                    throw new IllegalStateException("El reporte #" + id + " ya fue resuelto con anterioridad");
                }
                if (Boolean.TRUE.equals(reporte.getReembolsoEnProceso())) {
                    throw new IllegalStateException("El reembolso del reporte #" + id + " ya está siendo procesado");
                }
                reporte.setReembolsoEnProceso(true);
                reporteRepository.save(reporte);
                return reporte.getOrdenId();
            });

            String canal;
            try {
                canal = paymentsClient.emitirReembolsoPorOrden(
                        ordenId,
                        id,
                        request.getMontoReembolso(),
                        request.getRespuestaAdmin(),
                        bearerToken
                );
            } catch (RuntimeException ex) {
                liberarReembolsoEnProceso(id);
                throw ex;
            }

            return ejecutarEnTransaccion(() -> {
                ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
                reporte.setEstado(request.getEstado());
                reporte.setRespuestaAdmin(request.getRespuestaAdmin());
                reporte.setReembolsoProcedente(true);
                reporte.setMontoReembolso(request.getMontoReembolso());
                reporte.setCanalDevolucion(canal);
                reporte.setReembolsoEnProceso(false);
                if (request.getEstado() == EstadoReclamo.RESUELTO || request.getEstado() == EstadoReclamo.RECHAZADO) {
                    reporte.setResueltoEn(LocalDateTime.now());
                }
                ReporteIncidencia guardado = reporteRepository.save(reporte);
                log.info("Reporte #{} resuelto con reembolso: canal={}, estado={}",
                        guardado.getId(), canal, guardado.getEstado());
                return ReporteResponse.from(guardado);
            });
        }

        return ejecutarEnTransaccion(() -> {
            ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
            if (reporte.getEstado() == EstadoReclamo.RESUELTO || reporte.getEstado() == EstadoReclamo.RECHAZADO) {
                throw new IllegalStateException("El reporte #" + id + " ya fue resuelto con anterioridad");
            }
            reporte.setEstado(request.getEstado());
            reporte.setRespuestaAdmin(request.getRespuestaAdmin());
            reporte.setReembolsoProcedente(false);
            reporte.setMontoReembolso(request.getMontoReembolso());
            if (request.getEstado() == EstadoReclamo.RESUELTO || request.getEstado() == EstadoReclamo.RECHAZADO) {
                reporte.setResueltoEn(LocalDateTime.now());
            }
            ReporteIncidencia guardado = reporteRepository.save(reporte);
            log.info("Reporte #{} resuelto con estado {}", guardado.getId(), guardado.getEstado());
            return ReporteResponse.from(guardado);
        });
    }

    /** Lista devoluciones en ventanilla pendientes de entrega (para cajero). */
    public List<ReporteResponse> listarDevolucionesPendientes() {
        return reporteRepository.findByCanalDevolucionAndDevueltoEnIsNullOrderByCreadoEnDesc(
                        "VENTANILLA", PageRequest.of(0, LIMITE_LISTADO_ADMIN))
                .stream().map(ReporteResponse::from).toList();
    }

    /**
     * Cajero marca una devolución en ventanilla como entregada.
     * Registra el egreso en caja fuera del bloqueo BD y sella devueltoEn.
     */
    public ReporteResponse marcarEntregado(Long id, String bearerToken) {
        ReporteIncidencia instantanea = ejecutarEnTransaccion(() -> {
            ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
            if (!"VENTANILLA".equals(reporte.getCanalDevolucion())) {
                throw new IllegalStateException(
                        "El reporte #" + id + " no corresponde a una devolución en ventanilla");
            }
            if (reporte.getDevueltoEn() != null) {
                throw new IllegalStateException(
                        "El reporte #" + id + " ya fue marcado como entregado el " + reporte.getDevueltoEn());
            }
            if (reporte.getMontoReembolso() == null) {
                throw new IllegalStateException("El reporte #" + id + " no tiene monto de reembolso definido");
            }
            if (Boolean.TRUE.equals(reporte.getEntregaEnProceso())) {
                throw new IllegalStateException("La entrega del reporte #" + id + " ya está siendo procesada");
            }
            reporte.setEntregaEnProceso(true);
            return reporteRepository.save(reporte);
        });

        try {
            // Registrar egreso en caja fuera de la transacción BD (CON-03)
            financeClient.registrarEgresoDevolución(
                    instantanea.getId(),
                    instantanea.getOrdenId(),
                    instantanea.getMontoReembolso(),
                    bearerToken
            );
        } catch (RuntimeException ex) {
            liberarEntregaEnProceso(id);
            throw ex;
        }

        return ejecutarEnTransaccion(() -> {
            ReporteIncidencia reporte = buscarConBloqueoOFallar(id);
            reporte.setDevueltoEn(LocalDateTime.now());
            reporte.setEntregaEnProceso(false);
            ReporteIncidencia guardado = reporteRepository.save(reporte);
            log.info("Reporte #{}: devolución en ventanilla entregada al cliente, monto S/ {}",
                    id, guardado.getMontoReembolso());
            return ReporteResponse.from(guardado);
        });
    }

    private void liberarReembolsoEnProceso(Long id) {
        try {
            ejecutarEnTransaccion(() -> {
                reporteRepository.buscarConBloqueo(id)
                        .or(() -> reporteRepository.findById(id))
                        .ifPresent(r -> {
                            r.setReembolsoEnProceso(false);
                            reporteRepository.save(r);
                        });
                return null;
            });
        } catch (Exception e) {
            log.warn("No se pudo liberar bloqueo de reembolso en reporte #{}: {}", id, e.getMessage());
        }
    }

    private void liberarEntregaEnProceso(Long id) {
        try {
            ejecutarEnTransaccion(() -> {
                reporteRepository.buscarConBloqueo(id)
                        .or(() -> reporteRepository.findById(id))
                        .ifPresent(r -> {
                            r.setEntregaEnProceso(false);
                            reporteRepository.save(r);
                        });
                return null;
            });
        } catch (Exception e) {
            log.warn("No se pudo liberar bloqueo de entrega en reporte #{}: {}", id, e.getMessage());
        }
    }

    private static BigDecimal extraerTotalOrden(Map<String, Object> orden) {
        if (orden == null || orden.get("total") == null) {
            return null;
        }
        try {
            return new BigDecimal(orden.get("total").toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private <T> T ejecutarEnTransaccion(Supplier<T> accion) {
        if (transactionManager == null) {
            return accion.get();
        }
        return new TransactionTemplate(transactionManager).execute(status -> accion.get());
    }

    private ReporteIncidencia buscarConBloqueoOFallar(Long id) {
        return reporteRepository.buscarConBloqueo(id)
                .or(() -> reporteRepository.findById(id))
                .orElseThrow(() -> new NoSuchElementException("Reporte de incidencia no encontrado: " + id));
    }

    private ReporteIncidencia buscarOFallar(Long id) {
        return reporteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reporte de incidencia no encontrado: " + id));
    }
}
