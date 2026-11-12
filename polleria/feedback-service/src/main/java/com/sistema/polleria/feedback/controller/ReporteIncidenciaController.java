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
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/feedback")
@RequiredArgsConstructor
public class ReporteIncidenciaController {

    private final ReporteIncidenciaService reporteService;
    private final FileStorageService fileStorageService;

    /** Crear reporte vía JSON */
    @PostMapping("/reportes")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> crearJson(
            @Valid @RequestBody CrearReporteRequest request,
            Principal principal) {
        Long clienteId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reporteService.crear(request, null, clienteId));
    }

    /** Crear reporte vía multipart con foto de evidencia */
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

    /**
     * Consultar reclamo de una orden específica.
     * Requiere autenticación: cliente solo ve su propio reclamo, admin ve cualquiera.
     */
    @GetMapping("/reportes/orden/{ordenId}")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<ReporteResponse> obtenerPorOrden(
            @PathVariable Long ordenId,
            Principal principal) {
        Long usuarioId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
        boolean esAdmin = SecurityUtils.esAdminOCajero(principal);
        return reporteService.obtenerPorOrden(ordenId, usuarioId, esAdmin)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    /** Ver detalle de un reporte — anti-IDOR: cliente solo ve el suyo */
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

    /** Cambiar estado del reclamo */
    @PatchMapping("/admin/reportes/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> cambiarEstado(
            @PathVariable Long id,
            @RequestParam("estado") EstadoReclamo estado) {
        return ResponseEntity.ok(reporteService.cambiarEstado(id, estado));
    }

    /** Resolver reclamo y opcionalmente autorizar reembolso (canal detectado automáticamente) */
    @PatchMapping("/admin/reportes/{id}/resolver")
    @PreAuthorize("hasAnyAuthority('ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> resolver(
            @PathVariable Long id,
            @Valid @RequestBody ResolverReporteRequest request,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(reporteService.resolver(id, request, authorization));
    }

    /** Lista devoluciones en ventanilla pendientes de entrega (para cajero) */
    @GetMapping("/devoluciones/pendientes")
    @PreAuthorize("hasAnyAuthority('CAJERO', 'ROLE_CAJERO', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<List<ReporteResponse>> devolucionesPendientes() {
        return ResponseEntity.ok(reporteService.listarDevolucionesPendientes());
    }

    /** Cajero entrega el efectivo al cliente: registra egreso en caja y sella devueltoEn */
    @PatchMapping("/reportes/{id}/entregar")
    @PreAuthorize("hasAnyAuthority('CAJERO', 'ROLE_CAJERO', 'ADMIN', 'ROLE_ADMIN')")
    public ResponseEntity<ReporteResponse> marcarEntregado(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(reporteService.marcarEntregado(id, authorization));
    }

    /**
     * Servir imagen de evidencia fotográfica por streaming desde MinIO.
     * Requiere autenticación: cliente solo puede ver las evidencias de sus propios reclamos (D4.5).
     * Se retorna 404 en lugar de 403 para no revelar existencia del recurso.
     */
    @GetMapping("/evidencias/{fileName:.+}")
    @PreAuthorize("hasAnyAuthority('CLIENTE', 'ROLE_CLIENTE', 'ADMIN', 'ROLE_ADMIN', 'CAJERO', 'ROLE_CAJERO')")
    public ResponseEntity<byte[]> verEvidencia(
            @PathVariable String fileName,
            Principal principal) {
        try {
            // Validar propiedad: buscar si algún reporte del cliente tiene esta evidencia
            boolean esAdmin = SecurityUtils.esAdminOCajero(principal);
            if (!esAdmin) {
                Long usuarioId = SecurityUtils.obtenerUsuarioIdAutenticado(principal);
                String urlEsperada = "/feedback/evidencias/" + fileName;
                boolean esPropia = reporteService.listarPorCliente(usuarioId).stream()
                        .anyMatch(r -> urlEsperada.equals(r.getFotoEvidenciaUrl()));
                if (!esPropia) {
                    return ResponseEntity.notFound().build();
                }
            }

            byte[] bytes = fileStorageService.leerArchivo(fileName);
            String contentType = fileStorageService.resolverContentType(fileName);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(bytes);

        } catch (NoSuchElementException | SecurityException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
