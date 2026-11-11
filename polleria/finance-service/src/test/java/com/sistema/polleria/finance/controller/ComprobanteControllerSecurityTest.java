package com.sistema.polleria.finance.controller;

import com.sistema.polleria.finance.config.SecurityConfig;
import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.filter.JwtAuthFilter;
import com.sistema.polleria.finance.service.ComprobanteService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Who may issue and read receipts (D3.5, D3.6, D3.18, R3.4, R3.14). */
@WebMvcTest(ComprobanteController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class})
@TestPropertySource(properties = {
        "jwt.secret=" + ComprobanteControllerSecurityTest.SECRETO,
        "internal.api-key=" + ComprobanteControllerSecurityTest.CLAVE_INTERNA,
        "cors.allowed-origins=http://localhost:4200"
})
class ComprobanteControllerSecurityTest {

    static final String SECRETO = "clave-de-pruebas-de-finance-con-al-menos-256-bits-0123456789";
    static final String CLAVE_INTERNA = "clave-interna-test";

    private static final String CUERPO = """
            {"ordenId":7,"tipo":"BOLETA","clienteNombre":"Cliente General","pagadoDigitalmente":true,"ingresoCaja":true}
            """;

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private ComprobanteService comprobanteService;

    private static String token(String rol, long userId) {
        return "Bearer " + Jwts.builder()
                .subject(rol.toLowerCase() + "@polleria.com")
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private static ComprobanteResponse respuesta() {
        return new ComprobanteResponse(1L, 7L, TipoComprobante.BOLETA, "B001-000001", "DNI", null,
                "Cliente General", null, new BigDecimal("8.47"), new BigDecimal("1.53"), BigDecimal.TEN,
                "PAGADO", BigDecimal.ZERO, LocalDateTime.now(), 9L);
    }

    private MockHttpServletRequestBuilder emitir() {
        return post("/finanzas/comprobantes").contentType(MediaType.APPLICATION_JSON).content(CUERPO);
    }

    @Test
    void sinCredencialesNoSeEmite() throws Exception {
        mvc.perform(emitir()).andExpect(status().isForbidden());
        verifyNoInteractions(comprobanteService);
    }

    @Test
    void clienteMozoYCocinaNoEmiten() throws Exception {
        for (String rol : new String[]{"CLIENTE", "MOZO", "COCINA"}) {
            mvc.perform(emitir().header("Authorization", token(rol, 3L))).andExpect(status().isForbidden());
        }
        verifyNoInteractions(comprobanteService);
    }

    @Test
    void cajeroEmiteYQuedaComoEmisorConSuJwt() throws Exception {
        when(comprobanteService.emitir(any(), any(), any())).thenReturn(respuesta());
        String jwt = token("CAJERO", 9L);

        mvc.perform(emitir().header("Authorization", jwt)).andExpect(status().isCreated());

        verify(comprobanteService).emitir(any(), eq(9L), eq(jwt));
    }

    @Test
    void adminEmite() throws Exception {
        when(comprobanteService.emitir(any(), any(), any())).thenReturn(respuesta());

        mvc.perform(emitir().header("Authorization", token("ADMIN", 1L))).andExpect(status().isCreated());

        verify(comprobanteService).emitir(any(), eq(1L), any());
    }

    @Test
    void llamadaInternaEmiteSinEmisorDeUsuario() throws Exception {
        when(comprobanteService.emitir(any(), any(), any())).thenReturn(respuesta());

        mvc.perform(emitir().header("X-Internal-Key", CLAVE_INTERNA)).andExpect(status().isCreated());

        verify(comprobanteService).emitir(any(), isNull(), isNull());
    }

    @Test
    void claveInternaIncorrectaNoEmite() throws Exception {
        mvc.perform(emitir().header("X-Internal-Key", "otra")).andExpect(status().isForbidden());
        verifyNoInteractions(comprobanteService);
    }

    @Test
    void elComprobanteDeUnaOrdenSoloLoLeenAdminYCajero() throws Exception {
        when(comprobanteService.obtenerPorOrdenId(7L)).thenReturn(respuesta());

        mvc.perform(get("/finanzas/comprobantes/orden/7").header("Authorization", token("CLIENTE", 3L)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/finanzas/comprobantes/orden/7").header("Authorization", token("CAJERO", 9L)))
                .andExpect(status().isOk());
        mvc.perform(get("/finanzas/comprobantes/orden/7").header("Authorization", token("ADMIN", 1L)))
                .andExpect(status().isOk());
    }
}
