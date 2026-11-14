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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReporteIncidenciaService {

    private final ReporteIncidenciaRepository reporteRepository;
    private final FileStorageService fileStorageService;
    private final PaymentsClient paymentsClient;
    private final OrdersClient ordersClient;
    private final FinanceClient financeClient;

    @Transactional
    public ReporteResponse crear(CrearReporteRequest request, MultipartFile foto, Long clienteId) {
        // Fail-closed: si orders-service no responde, lanza 503
        ordersClient.obtenerYValidarOrden(request.getOrdenId(), clienteId, false);

        // Un solo reclamo activo por orden
        if (reporteRepository.existsByOrdenId(request.getOrdenId())) {
            throw new IllegalStateException(
                    "Ya existe un reclamo registrado para la orden #" + request.getOrdenId());
        }

        String fotoUrl = request.getFotoEvidenciaUrl();
        if (foto != null && !foto.isEmpty()) {
            fotoUrl = fileStorageService.guardarArchivo(foto);
        }

        ReporteIncidencia reporte = ReporteIncidencia.builder()
                .ordenId(request.getOrdenId())
                .clienteId(clienteId)
                .motivo(request.getMotivo())
                .descripcion(request.getDescripcion())
                .fotoEvidenciaUrl(fotoUrl)
                .estado(EstadoReclamo.ABIERTO)
                .reembolsoProcedente(false)
                .build();

        reporte = reporteRepository.save(reporte);
        log.info("Reporte #{} creado para orden #{} por cliente #{}", reporte.getId(), reporte.getOrdenId(), clienteId);
        return ReporteResponse.from(reporte);
    }

    public List<ReporteResponse> listarPorCliente(Long clienteId) {
        return reporteRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(ReporteResponse::from).toList();
    }

    public List<ReporteResponse> listarAdmin(EstadoReclamo estado, MotivoReclamo motivo) {
        if (estado != null && motivo != null) {
            return reporteRepository.findByEstadoAndMotivoOrderByCreadoEnDesc(estado, motivo)
                    .stream().map(ReporteResponse::from).toList();
        } else if (estado != null) {
            return reporteRepository.findByEstadoOrderByCreadoEnDesc(estado)
                    .stream().map(ReporteResponse::from).toList();
        } else if (motivo != null) {
            return reporteRepository.findByMotivoOrderByCreadoEnDesc(motivo)
                    .stream().map(ReporteResponse::from).toList();
        }
        return reporteRepository.findAllByOrderByCreadoEnDesc()
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

    @Transactional
    public ReporteResponse cambiarEstado(Long id, EstadoReclamo nuevoEstado) {
        ReporteIncidencia reporte = buscarOFallar(id);
        reporte.setEstado(nuevoEstado);
        reporte = reporteRepository.save(reporte);
        log.info("Reporte #{} movido a estado {}", id, nuevoEstado);
        return ReporteResponse.from(reporte);
    }

    @Transactional
    public ReporteResponse resolver(Long id, ResolverReporteRequest request, String bearerToken) {
        ReporteIncidencia reporte = buscarOFallar(id);

        if (reporte.getEstado() == EstadoReclamo.RESUELTO || reporte.getEstado() == EstadoReclamo.RECHAZADO) {
            throw new IllegalStateException("El reporte #" + id + " ya fue resuelto con anterioridad");
        }

        reporte.setEstado(request.getEstado());
        reporte.setRespuestaAdmin(request.getRespuestaAdmin());
        reporte.setReembolsoProcedente(Boolean.TRUE.equals(request.getReembolsoProcedente()));
        reporte.setMontoReembolso(request.getMontoReembolso());

        if (request.getEstado() == EstadoReclamo.RESUELTO || request.getEstado() == EstadoReclamo.RECHAZADO) {
            reporte.setResueltoEn(LocalDateTime.now());
        }

        if (Boolean.TRUE.equals(request.getReembolsoProcedente()) && request.getMontoReembolso() != null) {
            String canal = paymentsClient.emitirReembolsoPorOrden(
                    reporte.getOrdenId(),
                    reporte.getId(),
                    request.getMontoReembolso(),
                    request.getRespuestaAdmin(),
                    bearerToken
            );
            reporte.setCanalDevolucion(canal);
            log.info("Reembolso para reporte #{}: canal={}", reporte.getId(), canal);
            // Si es ventanilla, devueltoEn se establece cuando el cajero entrega el efectivo
        }

        reporte = reporteRepository.save(reporte);
        log.info("Reporte #{} resuelto con estado {}", reporte.getId(), reporte.getEstado());
        return ReporteResponse.from(reporte);
    }

    /** Lista devoluciones en ventanilla pendientes de entrega (para cajero). */
    public List<ReporteResponse> listarDevolucionesPendientes() {
        return reporteRepository.findByCanalDevolucionAndDevueltoEnIsNullOrderByCreadoEnDesc("VENTANILLA")
                .stream().map(ReporteResponse::from).toList();
    }

    /**
     * Cajero marca una devolución en ventanilla como entregada.
     * Registra el egreso en caja y sella devueltoEn.
     */
    @Transactional
    public ReporteResponse marcarEntregado(Long id, String bearerToken) {
        ReporteIncidencia reporte = buscarOFallar(id);

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

        // Registrar egreso en caja (409 si caja cerrada)
        financeClient.registrarEgresoDevolución(
                reporte.getId(),
                reporte.getOrdenId(),
                reporte.getMontoReembolso(),
                bearerToken
        );

        reporte.setDevueltoEn(LocalDateTime.now());
        reporte = reporteRepository.save(reporte);
        log.info("Reporte #{}: devolución en ventanilla entregada al cliente, monto S/ {}", id, reporte.getMontoReembolso());
        return ReporteResponse.from(reporte);
    }

    private ReporteIncidencia buscarOFallar(Long id) {
        return reporteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reporte de incidencia no encontrado: " + id));
    }
}
