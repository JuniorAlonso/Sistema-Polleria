package com.sistema.polleria.payments.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Autentica las llamadas entre microservicios con la cabecera {@code X-Internal-Key}, el mismo
 * mecanismo que ya usa orders-service ({@code JwtAuthFilter}): lee la clave compartida
 * {@code internal.api-key} y, si coincide, deja un principal autenticado.
 *
 * Vive en {@code config/} y se registra desde {@link SecurityConfig} porque el
 * {@code JwtAuthFilter} de este servicio solo entiende Bearer y no se modifica: este filtro corre
 * justo antes que él y solo cubre el endpoint interno {@code /pagos/comprobante}.
 *
 * A diferencia de orders-service, la autoridad concedida es {@code INTERNAL} y no {@code ADMIN}:
 * el notification-service (T6b) solo necesita registrar el comprobante, no leer todos los pagos
 * ni ejecutar reembolsos. La comparación es en tiempo constante y falla cerrada si no hay clave
 * configurada.
 */
public class ClaveInternaFilter extends OncePerRequestFilter {

    public static final String CABECERA = "X-Internal-Key";
    public static final String AUTORIDAD = "INTERNAL";

    private final String claveInterna;

    public ClaveInternaFilter(String claveInterna) {
        this.claveInterna = claveInterna;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String claveRecibida = request.getHeader(CABECERA);
        if (claveRecibida != null && !claveRecibida.isBlank()
                && esClaveValida(claveRecibida)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            var authorities = List.of(
                    new SimpleGrantedAuthority(AUTORIDAD),
                    new SimpleGrantedAuthority("ROLE_" + AUTORIDAD));
            var auth = new UsernamePasswordAuthenticationToken("internal-service", 0L, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }

    private boolean esClaveValida(String claveRecibida) {
        if (claveInterna == null || claveInterna.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                claveInterna.getBytes(StandardCharsets.UTF_8),
                claveRecibida.getBytes(StandardCharsets.UTF_8));
    }
}
