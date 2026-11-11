package com.sistema.polleria.finance.config;

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
 * Authenticates service-to-service calls with {@code X-Internal-Key}, granting only the
 * {@code INTERNAL} authority, as payments-service does. It runs after {@code JwtAuthFilter}, so a
 * valid user JWT always wins and keeps the user's identity. The comparison is constant-time and
 * fails closed when no key is configured. Every finance endpoint names its roles explicitly, so
 * {@code INTERNAL} only opens the ones that list it (receipt emission, D3.18).
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
            // No user id: the emitter of an internal call is unknown (emitidoPor stays null).
            var auth = new UsernamePasswordAuthenticationToken("internal-service", null, authorities);
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
