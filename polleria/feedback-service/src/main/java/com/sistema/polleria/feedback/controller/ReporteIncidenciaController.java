package com.sistema.polleria.feedback.controller;

import com.sistema.polleria.feedback.dto.CrearReporteRequest;
import com.sistema.polleria.feedback.dto.ReporteResponse;
import com.sistema.polleria.feedback.dto.ResolverReporteRequest;
import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.security.SecurityUtils;
import com.sistema.polleria.feedback.service.FileStorageService;
import com.sistema.polleria.feedback.service.ReporteIncidenciaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/feedback")
@RequiredArgsConstructor
public class ReporteIncidenciaController {

    private final ReporteIncidenciaService reporteService;
    private final FileStorageService fileStorageService;

    /** Crear reporte vía JSON directo */
    @PostMapping("/reportes")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> crearJson(
            @Valid @RequestBody CrearReporteRequest request,
            Principal principal) {
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reporteService.crear(request, null, clienteId));
    }

    /** Crear reporte vía multipart con archivo adjunto */
    @PostMapping(value = "/reportes/multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> crearMultipart(
            @RequestParam("ordenId") Long ordenId,
            @RequestParam("motivo") MotivoReclamo motivo,
            @RequestParam("descripcion") String descripcion,
            @RequestParam(value = "foto", required = false) MultipartFile foto,
            Principal principal) {
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        CrearReporteRequest request = CrearReporteRequest.builder()
                .ordenId(ordenId)
                .motivo(motivo)
                .descripcion(descripcion)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reporteService.crear(request, foto, clienteId));
    }

    /** Historial de reclamos del cliente autenticado */
    @GetMapping("/reportes/mis-reportes")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ReporteResponse>> misReportes(Principal principal) {
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        return ResponseEntity.ok(reporteService.listarPorCliente(clienteId));
    }

    /** Consultar reporte de una orden específica (para seguimiento del cliente) */
    @GetMapping("/reportes/orden/{ordenId}")
    public ResponseEntity<ReporteResponse> obtenerPorOrden(@PathVariable Long ordenId) {
        return reporteService.obtenerPorOrden(ordenId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    /** Ver detalle de un reporte con validación de permisos anti-IDOR */
    @GetMapping("/reportes/{id}")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> obtenerPorId(
            @PathVariable Long id,
            Principal principal) {
        Long usuarioId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        boolean esAdmin = SecurityUtils.esAdmin(principal);
        return ResponseEntity.ok(reporteService.obtenerPorIdSeguro(id, usuarioId, esAdmin));
    }

    /** Dashboard de reclamos para ADMIN */
    @GetMapping("/admin/reportes")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ReporteResponse>> listarAdmin(
            @RequestParam(value = "estado", required = false) EstadoReclamo estado,
            @RequestParam(value = "motivo", required = false) MotivoReclamo motivo) {
        return ResponseEntity.ok(reporteService.listarAdmin(estado, motivo));
    }

    /** Cambiar estado de reclamo (ej. pasar a EN_REVISION) */
    @PatchMapping("/admin/reportes/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> cambiarEstado(
            @PathVariable Long id,
            @RequestParam("estado") EstadoReclamo estado) {
        return ResponseEntity.ok(reporteService.cambiarEstado(id, estado));
    }

    /** Resolver reclamo y opcionalmente autorizar reembolso */
    @PatchMapping("/admin/reportes/{id}/resolver")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> resolver(
            @PathVariable Long id,
            @Valid @RequestBody ResolverReporteRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(reporteService.resolver(id, request, authorization));
    }

    /** Descargar/ver imagen de evidencia fotográfica por streaming seguro */
    @GetMapping("/evidencias/{fileName:.+}")
    public ResponseEntity<Resource> verEvidencia(@PathVariable String fileName) {
        try {
            Resource recurso = fileStorageService.cargarComoRecurso(fileName);
            String contentType = Files.probeContentType(recurso.getFile().toPath());
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + recurso.getFilename() + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(recurso);
        } catch (IOException | SecurityException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
