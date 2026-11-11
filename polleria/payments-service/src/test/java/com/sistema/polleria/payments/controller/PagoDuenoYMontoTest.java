package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.config.SecurityConfig;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.filter.JwtAuthFilter;
import com.sistema.polleria.payments.service.AutorizacionPago;
import com.sistema.polleria.payments.service.FirmadorComprobantes;
import com.sistema.polleria.payments.service.OrdenesClient;
import com.sistema.polleria.payments.service.PagoService;
import com.sistema.polleria.payments.service.ValidadorMontoPago;
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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Owner check on payment reads (D3.7), roles of iniciar and amount against the order (R3.4, plan 4.1). */
@WebMvcTest(PagoController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, AutorizacionPago.class, ValidadorMontoPago.class})
@TestPropertySource(properties = {
        "jwt.secret=" + PagoDuenoYMontoTest.SECRETO,
        "internal.api-key=clave",
        "cors.allowed-origins=http://localhost:4200"
})
class PagoDuenoYMontoTest {

    static final String SECRETO = "clave-de-pruebas-de-payments-con-al-menos-256-bits-0123456789";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private PagoService pagoService;
    @MockitoBean
    private FirmadorComprobantes firmadorComprobantes;
    @MockitoBean
    private OrdenesClient ordenesClient;

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

    private static PagoResponse pagoDe(long clienteId) {
        return new PagoResponse(5L, 7L, clienteId, new BigDecimal("40.00"), MetodoPago.CONTRAENTREGA,
                EstadoPago.APROBADO, null, null, LocalDateTime.now(), LocalDateTime.now());
    }

    private static String iniciarCuerpo(String monto) {
        return "{\"ordenId\":7,\"monto\":" + monto + ",\"metodoPago\":\"CONTRAENTREGA\"}";
    }

    private void ordenConTotal(String total) {
        when(ordenesClient.obtener(7L)).thenReturn(
                new OrdenesClient.OrdenInfo(7L, "RECIBIDO", "SALON", new BigDecimal(total), 3L, LocalDateTime.now()));
    }

    @Test
    void clienteLeeSuPropioPagoPorIdYPorOrden() throws Exception {
        when(pagoService.obtener(5L)).thenReturn(pagoDe(3L));
        when(pagoService.obtenerPorOrden(7L)).thenReturn(pagoDe(3L));

        mvc.perform(get("/pagos/5").header("Authorization", token("CLIENTE", 3L))).andExpect(status().isOk());
        mvc.perform(get("/pagos/orden/7").header("Authorization", token("CLIENTE", 3L))).andExpect(status().isOk());
    }

    private void ordenDe(long clienteId, String total) {
        when(ordenesClient.obtener(7L)).thenReturn(
                new OrdenesClient.OrdenInfo(7L, "EN_PUERTA", "DELIVERY", new BigDecimal(total), clienteId, LocalDateTime.now()));
    }

    @Test
    void clienteLeeElPagoQueInicioElPersonalSiLaOrdenEsSuya() throws Exception {
        PagoResponse delCajero = new PagoResponse(5L, 7L, 9L, new BigDecimal("40.00"), MetodoPago.CONTRAENTREGA,
                EstadoPago.APROBADO, null, null, LocalDateTime.now(), LocalDateTime.now());
        when(pagoService.obtenerPorOrden(7L)).thenReturn(delCajero);
        ordenDe(3L, "40.00");

        mvc.perform(get("/pagos/orden/7").header("Authorization", token("CLIENTE", 3L))).andExpect(status().isOk());
    }

    @Test
    void clienteNoConoceElTotalDeUnaOrdenAjenaAlIniciarUnPago() throws Exception {
        ordenDe(99L, "45.00");

        mvc.perform(post("/pagos").header("Authorization", token("CLIENTE", 3L))
                        .contentType(MediaType.APPLICATION_JSON).content(iniciarCuerpo("40.00")))
                .andExpect(status().isNotFound());
        verify(pagoService, never()).iniciar(any(), anyLong(), anyString());
    }

    @Test
    void clienteNoLeeUnPagoAjeno() throws Exception {
        when(pagoService.obtener(5L)).thenReturn(pagoDe(99L));
        when(pagoService.obtenerPorOrden(7L)).thenReturn(pagoDe(99L));
        ordenDe(99L, "40.00");

        mvc.perform(get("/pagos/5").header("Authorization", token("CLIENTE", 3L))).andExpect(status().isForbidden());
        mvc.perform(get("/pagos/orden/7").header("Authorization", token("CLIENTE", 3L))).andExpect(status().isForbidden());
    }

    @Test
    void elPersonalLeeCualquierPago() throws Exception {
        when(pagoService.obtenerPorOrden(7L)).thenReturn(pagoDe(99L));

        for (String rol : new String[]{"CAJERO", "ADMIN", "MOZO", "REPARTIDOR"}) {
            mvc.perform(get("/pagos/orden/7").header("Authorization", token(rol, 1L))).andExpect(status().isOk());
        }
    }

    @Test
    void elMozoYaNoIniciaPagos() throws Exception {
        mvc.perform(post("/pagos").header("Authorization", token("MOZO", 2L))
                        .contentType(MediaType.APPLICATION_JSON).content(iniciarCuerpo("40.00")))
                .andExpect(status().isForbidden());
        verify(pagoService, never()).iniciar(any(), anyLong(), anyString());
    }

    @Test
    void unMontoDistintoAlTotalDeLaOrdenEsConflicto() throws Exception {
        ordenConTotal("45.00");

        mvc.perform(post("/pagos").header("Authorization", token("CAJERO", 9L))
                        .contentType(MediaType.APPLICATION_JSON).content(iniciarCuerpo("40.00")))
                .andExpect(status().isConflict());
        verify(pagoService, never()).iniciar(any(), anyLong(), anyString());
    }

    @Test
    void elMontoIgualAlTotalIniciaElPago() throws Exception {
        ordenConTotal("40.0");
        when(pagoService.iniciar(any(), anyLong(), anyString())).thenReturn(pagoDe(9L));

        mvc.perform(post("/pagos").header("Authorization", token("CAJERO", 9L))
                        .contentType(MediaType.APPLICATION_JSON).content(iniciarCuerpo("40.00")))
                .andExpect(status().isCreated());
        mvc.perform(post("/pagos").header("Authorization", token("CLIENTE", 3L))
                        .contentType(MediaType.APPLICATION_JSON).content(iniciarCuerpo("40.00")))
                .andExpect(status().isCreated());
    }
}
