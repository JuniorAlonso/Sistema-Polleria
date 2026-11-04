package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.entity.Categoria;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            errors.put(field, error.getDefaultMessage());
        });
        return ResponseEntity.badRequest().body(Map.of("errors", errors, "status", 400));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage(), "status", 404));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleNotReadable(HttpMessageNotReadableException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "";
        if (msg.contains("Categoria")) {
            String validas = Arrays.stream(Categoria.values())
                    .map(Enum::name)
                    .collect(Collectors.joining(", "));
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Categoría inválida. Las categorías disponibles son: " + validas,
                    "status", 400));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "JSON inválido: " + msg, "status", 400));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage(), "status", 400));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "No tienes permisos para esta acción", "status", 403));
    }

    @ExceptionHandler(com.sistema.polleria.orders.exception.DemasiadasSolicitudesException.class)
    public ResponseEntity<Map<String, Object>> handleDemasiadasSolicitudes(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", ex.getMessage(), "status", 429));
    }

    @ExceptionHandler(org.springframework.web.bind.MissingRequestHeaderException.class)
    public ResponseEntity<Map<String, Object>> handleMissingHeader(org.springframework.web.bind.MissingRequestHeaderException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", "Falta el header " + ex.getHeaderName(), "status", 400));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", "Parámetro inválido: " + ex.getName(), "status", 400));
    }

    @ExceptionHandler({
            org.springframework.dao.OptimisticLockingFailureException.class,
            jakarta.persistence.OptimisticLockException.class
    })
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(Exception ex) {
        log.warn("Conflicto de concurrencia detectado (OptimisticLock): {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "El recurso fue modificado por otro usuario en simultáneo. Por favor recarga los datos e intenta nuevamente.",
                "status", 409
        ));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Violación de integridad referencial o constraint única: {}", ex.getMessage());
        String mensaje = "Conflicto de datos: ya existe un registro con el mismo identificador o número único.";
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", mensaje,
                "status", 409
        ));
    }

    @ExceptionHandler(com.sistema.polleria.orders.exception.ConflictoDeEstadoException.class)
    public ResponseEntity<Map<String, Object>> handleConflictoDeEstado(com.sistema.polleria.orders.exception.ConflictoDeEstadoException ex) {
        log.warn("Operación rechazada por conflicto de estado: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", ex.getMessage(),
                "status", 409
        ));
    }

    /**
     * Una ruta que no existe debe responder 404, nunca 500.
     */
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResourceFound(
            org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        log.warn("Ruta no encontrada: {}", ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "Ruta no encontrada: " + ex.getResourcePath(),
                "status", 404));
    }

    /**
     * Un método HTTP no soportado en una ruta existente debe responder 405, no 500.
     */
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotAllowed(
            org.springframework.web.HttpRequestMethodNotSupportedException ex) {
        log.warn("Método {} no permitido", ex.getMethod());
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(Map.of(
                "error", "Método " + ex.getMethod() + " no permitido en esta ruta",
                "status", 405));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneral(Exception ex) {
        log.error("Error inesperado: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Error interno del servidor", "status", 500));
    }
}
