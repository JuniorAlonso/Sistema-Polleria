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

    @Transactional
    public ReporteResponse crear(CrearReporteRequest request, MultipartFile foto, Long clienteId) {
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

    public ReporteResponse obtenerPorId(Long id) {
        return ReporteResponse.from(buscarOFallar(id));
    }

    @Transactional
    public ReporteResponse resolver(Long id, ResolverReporteRequest request, String bearerToken) {
        ReporteIncidencia reporte = buscarOFallar(id);

        reporte.setEstado(request.getEstado());
        reporte.setRespuestaAdmin(request.getRespuestaAdmin());
        reporte.setReembolsoProcedente(Boolean.TRUE.equals(request.getReembolsoProcedente()));
        reporte.setMontoReembolso(request.getMontoReembolso());
        reporte.setResueltoEn(LocalDateTime.now());

        if (Boolean.TRUE.equals(request.getReembolsoProcedente())) {
            log.info("Ejecutando reembolso automático para orden #{}, monto S/ {}",
                    reporte.getOrdenId(), request.getMontoReembolso());
            paymentsClient.emitirReembolsoPorOrden(
                    reporte.getOrdenId(),
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
