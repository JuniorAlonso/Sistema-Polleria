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

    @Transactional
    public ReporteResponse crear(CrearReporteRequest request, MultipartFile foto, Long clienteId) {
        // Validar orden contra orders-service
        ordersClient.obtenerYValidarOrden(request.getOrdenId(), clienteId, false);

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
        log.info("Reporte de incidencia #{} creado para orden #{} por cliente #{}",
                reporte.getId(), reporte.getOrdenId(), clienteId);
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

    public java.util.Optional<ReporteResponse> obtenerPorOrden(Long ordenId) {
        return reporteRepository.findFirstByOrdenIdOrderByCreadoEnDesc(ordenId)
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

        if (reporte.getEstado() == EstadoReclamo.RESUELTO) {
            throw new IllegalStateException("El reporte #" + id + " ya fue resuelto con anterioridad");
        }

        reporte.setEstado(request.getEstado());
        reporte.setRespuestaAdmin(request.getRespuestaAdmin());
        reporte.setReembolsoProcedente(Boolean.TRUE.equals(request.getReembolsoProcedente()));
        reporte.setMontoReembolso(request.getMontoReembolso());

        if (request.getEstado() == EstadoReclamo.RESUELTO || request.getEstado() == EstadoReclamo.RECHAZADO) {
            reporte.setResueltoEn(LocalDateTime.now());
        }

        if (Boolean.TRUE.equals(request.getReembolsoProcedente())) {
            log.info("Ejecutando reembolso automático para orden #{}, reporte #{}, monto S/ {}",
                    reporte.getOrdenId(), reporte.getId(), request.getMontoReembolso());
            paymentsClient.emitirReembolsoPorOrden(
                    reporte.getOrdenId(),
                    reporte.getId(),
                    request.getMontoReembolso(),
                    request.getRespuestaAdmin(),
                    bearerToken
            );
        }

        reporte = reporteRepository.save(reporte);
        log.info("Reporte #{} resuelto con estado {}", reporte.getId(), reporte.getEstado());
        return ReporteResponse.from(reporte);
    }

    private ReporteIncidencia buscarOFallar(Long id) {
        return reporteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reporte de incidencia no encontrado: " + id));
    }
}
