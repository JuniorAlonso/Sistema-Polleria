package com.sistema.polleria.incident;

import com.sistema.polleria.incident.config.SecurityConfig;
import com.sistema.polleria.incident.controller.GlobalExceptionHandler;
import com.sistema.polleria.incident.filter.JwtAuthFilter;
import com.sistema.polleria.incident.service.IncidenteService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class IncidentAuditHardeningTest {

    private static final String SECRET = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    @AfterEach
    void limpiarContextoSeguridad() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @SuppressWarnings("unchecked")
    void corsExcluyeLoopbackCuandoFlagEstaDesactivado() throws Exception {
        Method m = SecurityConfig.class.getDeclaredMethod("origenesPermitidos", String.class, boolean.class);
        m.setAccessible(true);
        List<String> origenes = (List<String>) m.invoke(null, "https://polleria.example", false);
        assertEquals(List.of("https://polleria.example"), origenes);
    }

    @Test
    void jwtFilterIgnoraTokenDeSeguimiento() throws Exception {
        String token = Jwts.builder()
                .subject("999000111")
                .claim("tipo", "seguimiento")
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        JwtAuthFilter filter = new JwtAuthFilter();
        ReflectionTestUtils.setField(filter, "secret", SECRET);

        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void globalExceptionHandlerMapeaConcurrenciaAConflict409() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        assertEquals(HttpStatus.CONFLICT,
                handler.handleConcurrencyConflict(new OptimisticLockingFailureException("stale")).getStatusCode());
    }
}
