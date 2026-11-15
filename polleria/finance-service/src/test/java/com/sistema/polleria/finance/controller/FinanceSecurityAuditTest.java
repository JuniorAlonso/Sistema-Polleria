package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.config.SecurityConfig;
import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.filter.JwtAuthFilter;
import com.sistema.polleria.finance.service.ComprobanteService;
import com.sistema.polleria.finance.service.LiquidacionService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({LiquidacionController.class, ComprobanteController.class, GlobalExceptionHandler.class})
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = {
        "jwt.secret=" + FinanceSecurityAuditTest.SECRETO,
        "internal.api-key=" + FinanceSecurityAuditTest.CLAVE_INTERNA,
        "cors.allowed-origins=https://polleria.example.com",
        "app.cors.allow-loopback=false"
})
class FinanceSecurityAuditTest {

    static final String SECRETO = "clave-de-pruebas-de-finance-con-al-menos-256-bits-0123456789";
    static final String CLAVE_INTERNA = "clave-interna-test";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private LiquidacionService liquidacionService;

    @MockitoBean
    private ComprobanteService comprobanteService;

    private static String token(String rol, long userId, String tipo) {
        var builder = Jwts.builder()
                .subject(rol.toLowerCase() + "@polleria.com")
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000));
        if (tipo != null) {
            builder.claim("tipo", tipo);
        }
        return "Bearer " + builder.signWith(Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8))).compact();
    }

    @Test
    void repartidorNoPuedeConsultarLiquidacionesDeOtroRepartidor() throws Exception {
        when(liquidacionService.listarPorRepartidor(7L)).thenReturn(List.of());

        mvc.perform(get("/finanzas/liquidaciones/repartidor/99")
                        .header("Authorization", token("REPARTIDOR", 7L, null)))
                .andExpect(status().isForbidden());

        mvc.perform(get("/finanzas/liquidaciones/repartidor/7")
                        .header("Authorization", token("REPARTIDOR", 7L, null)))
                .andExpect(status().isOk());

        mvc.perform(get("/finanzas/liquidaciones/repartidor/99")
                        .header("Authorization", token("CAJERO", 2L, null)))
                .andExpect(status().isOk());
    }

    @Test
    void tokenDeSeguimientoEsRechazadoPorJwtAuthFilter() throws Exception {
        mvc.perform(get("/finanzas/liquidaciones/repartidor/7")
                        .header("Authorization", token("REPARTIDOR", 7L, "seguimiento")))
                .andExpect(status().isForbidden());

        verifyNoInteractions(liquidacionService);
    }

    @Test
    void corsRechazaLoopbackCuandoAllowLoopbackEstaDesactivado() throws Exception {
        mvc.perform(options("/finanzas/comprobantes")
                        .header("Origin", "http://localhost:4300")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));

        mvc.perform(options("/finanzas/comprobantes")
                        .header("Origin", "https://polleria.example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(header().string("Access-Control-Allow-Origin", "https://polleria.example.com"));
    }

    @Test
    void conflictosDeConcurrenciaEIntegridadResponden409YAnulacionFunciona() throws Exception {
        when(comprobanteService.anularPorOrden(eq(10L), any(), eq(1L))).thenReturn(
                new ComprobanteResponse(1L, 10L, TipoComprobante.BOLETA, "B001-000001", "DNI", null,
                        "Cliente", null, new BigDecimal("8.47"), new BigDecimal("1.53"), BigDecimal.TEN,
                        "PAGADO", BigDecimal.ZERO, LocalDateTime.now(), 1L, true, LocalDateTime.now(), "Cancelado"));

        mvc.perform(post("/finanzas/comprobantes/orden/10/anular")
                        .param("motivo", "Cancelado")
                        .header("Authorization", token("ADMIN", 1L, null)))
                .andExpect(status().isOk());

        when(liquidacionService.listarPorRepartidor(8L))
                .thenThrow(new OptimisticLockingFailureException("stale row"));
        mvc.perform(get("/finanzas/liquidaciones/repartidor/8")
                        .header("Authorization", token("ADMIN", 1L, null)))
                .andExpect(status().isConflict());

        when(liquidacionService.listarPorRepartidor(9L))
                .thenThrow(new DataIntegrityViolationException("uq_liquidacion_abierta_repartidor"));
        mvc.perform(get("/finanzas/liquidaciones/repartidor/9")
                        .header("Authorization", token("ADMIN", 1L, null)))
                .andExpect(status().isConflict());
    }
}
