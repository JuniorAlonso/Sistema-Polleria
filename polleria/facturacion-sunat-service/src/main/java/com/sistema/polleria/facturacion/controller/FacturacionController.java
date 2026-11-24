package com.sistema.polleria.facturacion.controller;

import com.sistema.polleria.facturacion.dto.EnvioResponse;
import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;
import com.sistema.polleria.facturacion.service.FacturacionService;
import com.sistema.polleria.facturacion.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Endpoints de facturación electrónica. Solo ADMIN y CAJERO.
 */
@RestController
@RequestMapping("/facturacion")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ADMIN','CAJERO')")
public class FacturacionController {

    private static final String TICKET_CSP = "default-src 'none'; style-src 'unsafe-inline';";

    private final FacturacionService facturacion;
    private final TicketService tickets;

    @PostMapping("/orden/{ordenId}/enviar")
    public ResponseEntity<EnvioResponse> enviar(@PathVariable Long ordenId,
                                                @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ResponseEntity.ok(facturacion.enviar(ordenId, authorization));
    }

    @GetMapping("/orden/{ordenId}")
    public ResponseEntity<EnvioResponse> estado(@PathVariable Long ordenId) {
        return ResponseEntity.ok(EnvioResponse.from(facturacion.obtener(ordenId)));
    }

    @GetMapping
    public ResponseEntity<List<EnvioResponse>> listar(@RequestParam(required = false) EstadoSunat estado) {
        return ResponseEntity.ok(facturacion.listar(estado));
    }

    @GetMapping("/orden/{ordenId}/xml")
    public ResponseEntity<byte[]> xml(@PathVariable Long ordenId) {
        EnvioSunat e = facturacion.obtener(ordenId);
        if (e.getXmlFirmado() == null || e.getXmlFirmado().isBlank()) {
            throw new NoSuchElementException("Aún no existe XML firmado para la orden #" + ordenId);
        }
        return archivo(e.getXmlFirmado().getBytes(StandardCharsets.UTF_8), e.getNombreArchivo() + ".xml",
                MediaType.APPLICATION_XML);
    }

    @GetMapping("/orden/{ordenId}/cdr")
    public ResponseEntity<byte[]> cdr(@PathVariable Long ordenId) {
        EnvioSunat e = facturacion.obtener(ordenId);
        if (e.getCdrZip() == null) {
            throw new NoSuchElementException("SUNAT todavía no devolvió CDR para la orden #" + ordenId
                    + " (estado: " + e.getEstado() + ")");
        }
        return archivo(e.getCdrZip(), "R-" + e.getNombreArchivo() + ".zip", MediaType.parseMediaType("application/zip"));
    }

    @GetMapping("/orden/{ordenId}/ticket")
    public ResponseEntity<String> ticket(@PathVariable Long ordenId) {
        EnvioSunat e = facturacion.obtener(ordenId);
        if (!e.getEstado().esDefinitivo()) {
            throw new IllegalStateException("El ticket SUNAT con QR solo está disponible para comprobantes aceptados u observados (estado actual: "
                    + e.getEstado() + ")");
        }
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .header("Content-Security-Policy", TICKET_CSP)
                .body(tickets.html(e, facturacion.lineas(e)));
    }

    private static ResponseEntity<byte[]> archivo(byte[] contenido, String nombre, MediaType tipo) {
        return ResponseEntity.ok()
                .contentType(tipo)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(nombre).build().toString())
                .body(contenido);
    }
}
