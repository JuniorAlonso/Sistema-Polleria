package com.sistema.polleria.payments.config;

import com.sistema.polleria.payments.controller.MercadoPagoWebhookController;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.OrdenesClient;
import com.sistema.polleria.payments.service.PagoService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentsSecurityHardeningTest {

    private static final String JWT_SECRET = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PagoService pagoService;

    private String firmarJwt(long userId, String rol, String tipo) {
        SecretKey key = Keys.hmacShaKeyFor(JWT_SECRET.getBytes(StandardCharsets.UTF_8));
        var builder = Jwts.builder()
                .subject("test@polleria.local")
                .claim("userId", userId)
                .claim("role", rol)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 600_000));
        if (tipo != null) {
            builder.claim("tipo", tipo);
        }
        return builder.signWith(key).compact();
    }

    @Test
    @DisplayName("SEC-14: origenesPermitidos bloquea wildcards loopback cuando allow-loopback=false")
    void cors_enProduccionSinLoopback_noAgregaPatronesLocales() {
        List<String> prod = SecurityConfig.origenesPermitidos("https://sanpollo.vercel.app/", false);
        assertThat(prod).containsExactly("https://sanpollo.vercel.app");

        List<String> dev = SecurityConfig.origenesPermitidos("https://sanpollo.vercel.app", true);
        assertThat(dev).contains("https://sanpollo.vercel.app", SecurityConfig.LOOPBACK_LOCALHOST);
    }

    @Test
    @DisplayName("SEC-11: token público tipo=seguimiento es rechazado con 401/403 en payments-service")
    void tokenSeguimiento_rechazadoCon401() throws Exception {
        String tokenSeguimiento = firmarJwt(10L, "CLIENTE", "seguimiento");

        mockMvc.perform(get("/pagos/mis-pagos")
                        .header("Authorization", "Bearer " + tokenSeguimiento))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                        org.hamcrest.Matchers.is(401),
                        org.hamcrest.Matchers.is(403))));
    }

    @Test
    @DisplayName("DIN-07: REPARTIDOR no puede invocar PATCH /pagos/{id}/confirmar (recibe 403)")
    void repartidorNoPuedeConfirmarPagoManualmente() throws Exception {
        String tokenRepartidor = firmarJwt(44L, "REPARTIDOR", null);

        mockMvc.perform(patch("/pagos/10/confirmar")
                        .header("Authorization", "Bearer " + tokenRepartidor)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"referenciaExterna\":\"REF-1\",\"detalle\":\"ok\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("CFG-10: webhook falla cerrado (401) cuando sandbox=false y secret está vacío")
    void webhook_produccionSinSecret_responde401() {
        PagoRepository repoMock = mock(PagoRepository.class);
        PagoService serviceMock = mock(PagoService.class);
        MercadoPagoWebhookController controller = new MercadoPagoWebhookController(repoMock, serviceMock);
        ReflectionTestUtils.setField(controller, "sandbox", false);
        ReflectionTestUtils.setField(controller, "webhookSecret", "");

        var resp = controller.handleWebhook(null, null, "payment", null, "123", "123", null);
        assertThat(resp.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    @DisplayName("CON-09: webhook de Order ante error transitorio local responde 500 para que MP reintente")
    void webhookOrder_errorTransitorio_responde500() throws Exception {
        when(pagoService.procesarRetornoMercadoPago(eq("555111"), any(), eq("20")))
                .thenThrow(new OrdenesClient.OrdenNoDisponibleException("timeout orders", null));

        String payload = """
                {
                  "type": "order",
                  "data": {
                    "id": "ORD-1",
                    "external_reference": "20",
                    "transactions": {
                      "payments": [
                        { "reference": { "id": "555111" } }
                      ]
                    }
                  }
                }
                """;

        mockMvc.perform(post("/pagos/webhook/mercadopago")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("DIN-07: aplicarEstadoDePasarela aplica partially_refunded e ignora approved sobre REEMBOLSADO_PARCIAL")
    void webhook_parcialmenteReembolsado_ignoraApprovedTardio() {
        PagoRepository repoMock = mock(PagoRepository.class);
        PagoService serviceMock = mock(PagoService.class);
        MercadoPagoWebhookController controller = new MercadoPagoWebhookController(repoMock, serviceMock);

        Pago pagoAprobado = new Pago();
        pagoAprobado.setId(50L);
        pagoAprobado.setOrdenId(500L);
        pagoAprobado.setMonto(new BigDecimal("50.00"));
        pagoAprobado.setEstado(EstadoPago.APROBADO);
        ReflectionTestUtils.invokeMethod(controller, "aplicarEstadoDePasarela",
                pagoAprobado, "partially_refunded", "991", "partial", "visa");
        verify(serviceMock).actualizarEstadoDesdePasarela(eq(50L), eq(EstadoPago.REEMBOLSADO_PARCIAL), any());

        Pago yaReembolsadoParcial = new Pago();
        yaReembolsadoParcial.setId(51L);
        yaReembolsadoParcial.setOrdenId(501L);
        yaReembolsadoParcial.setMonto(new BigDecimal("50.00"));
        yaReembolsadoParcial.setMetodoPago(MetodoPago.TARJETA);
        yaReembolsadoParcial.setEstado(EstadoPago.REEMBOLSADO_PARCIAL);
        ReflectionTestUtils.invokeMethod(controller, "aplicarEstadoDePasarela",
                yaReembolsadoParcial, "approved", "992", "accredited", "visa");
        verify(serviceMock, never()).confirmar(eq(51L), any(), any());
    }
}
