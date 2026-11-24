package com.sistema.polleria.facturacion.controller;

import com.sistema.polleria.facturacion.service.AccesoRechazadoInternoException;
import com.sistema.polleria.facturacion.service.CertificadoSunatException;
import com.sistema.polleria.facturacion.service.ServiciosInternos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;

/** Convierte errores en respuestas JSON {"error": "..."} consistentes con el resto de servicios. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(NoSuchElementException e) {
        return respuesta(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> recursoNoEncontrado(NoResourceFoundException e) {
        return respuesta(HttpStatus.NOT_FOUND, "Ruta no encontrada");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> metodoNoSoportado(HttpRequestMethodNotSupportedException e) {
        return respuesta(HttpStatus.METHOD_NOT_ALLOWED, "Método HTTP no permitido");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> parametroInvalido(IllegalArgumentException e) {
        return respuesta(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> tipoInvalido(MethodArgumentTypeMismatchException e) {
        return respuesta(HttpStatus.BAD_REQUEST, "Parámetro inválido: " + e.getName());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> conflicto(IllegalStateException e) {
        log.warn("Facturación: {}", e.getMessage());
        return respuesta(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(AccesoRechazadoInternoException.class)
    public ResponseEntity<Map<String, String>> accesoInternoRechazado(AccesoRechazadoInternoException e) {
        HttpStatus status = e.getStatus() == 401 ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
        return respuesta(status, e.getMessage());
    }

    @ExceptionHandler(CertificadoSunatException.class)
    public ResponseEntity<Map<String, String>> certificadoInvalido(CertificadoSunatException e) {
        log.error("Error de certificado digital SUNAT: {}", e.getMessage(), e);
        return respuesta(HttpStatus.SERVICE_UNAVAILABLE,
                "Servicio de firma digital no disponible. Verifica la configuración del certificado SUNAT.");
    }

    @ExceptionHandler(ServiciosInternos.ServicioNoDisponibleException.class)
    public ResponseEntity<Map<String, String>> servicioCaido(RuntimeException e) {
        return respuesta(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> integridad(DataIntegrityViolationException e) {
        String detalle = e.getMostSpecificCause() != null ? e.getMostSpecificCause().getMessage() : e.getMessage();
        String lower = detalle == null ? "" : detalle.toLowerCase(Locale.ROOT);
        if (lower.contains("serie_numero") || lower.contains("orden_id")) {
            return respuesta(HttpStatus.CONFLICT, "Ese número de comprobante ya fue registrado para otra orden");
        }
        return respuesta(HttpStatus.CONFLICT, "Conflicto de integridad al registrar el envío SUNAT");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> sinPermiso(AccessDeniedException e) {
        return respuesta(HttpStatus.FORBIDDEN, "Solo ADMIN o CAJERO pueden usar la facturación electrónica");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> errorInesperado(Exception e) {
        log.error("Error inesperado en facturacion-sunat-service", e);
        return respuesta(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno en facturacion-sunat-service");
    }

    private static ResponseEntity<Map<String, String>> respuesta(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("error", mensaje == null ? estado.getReasonPhrase() : mensaje));
    }
}
