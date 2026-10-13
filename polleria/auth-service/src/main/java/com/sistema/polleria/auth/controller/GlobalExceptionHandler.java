package com.sistema.polleria.auth.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage(), "status", 400));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", ex.getMessage(), "status", 429));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Credenciales inválidas", "status", 401));
    }

    @ExceptionHandler(com.sistema.polleria.auth.exception.TokenRefreshException.class)
    public ResponseEntity<Map<String, Object>> handleTokenRefresh(com.sistema.polleria.auth.exception.TokenRefreshException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage(), "status", 401));
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

    /**
     * Un rechazo de autorización debe responder 403, nunca 500.
     *
     * `@PreAuthorize` lanza AccessDeniedException (AuthorizationDeniedException) dentro del
     * DispatcherServlet, así que el catch-all de abajo lo convertía en "Error interno del
     * servidor" y el cliente no podía distinguir "no tenés permiso" de "el servicio se rompió".
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex) {
        log.warn("Acceso denegado: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "error", "No tienes permisos para realizar esta operación",
                "status", 403));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneral(Exception ex) {
        log.error("Error inesperado: ", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Error interno del servidor", "status", 500));
    }
}
