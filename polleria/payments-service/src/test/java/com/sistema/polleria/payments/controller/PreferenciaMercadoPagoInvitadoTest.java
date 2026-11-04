package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PreferenceResponse;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.NotificadorOrden;
import com.sistema.polleria.payments.service.OrdenesClient;
import com.sistema.polleria.payments.service.WhatsappNotificationClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * T3 (S1) — El checkout web deja pagar con tarjeta a un invitado (sin JWT): la preferencia de
 * Mercado Pago debe poder crearse sin sesión, igual que {@code /pagos/yape-otp}, validando en el
 * servidor que la orden siga PENDIENTE_PAGO y que el monto sea su total. Ningún otro endpoint se abre.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PreferenciaMercadoPagoInvitadoTest {

    private static final String URL = "/pagos/mercadopago/preferencia";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PagoRepository pagoRepository;

    @MockitoBean
    private MercadoPagoGateway mercadoPagoGateway;

    @MockitoBean
    private OrdenesClient ordenesClient;

    @MockitoBean
    private NotificadorOrden notificadorOrden;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @BeforeEach
    void ordenPendienteDe4550() {
        when(ordenesClient.obtener(anyLong())).thenAnswer(inv -> new OrdenesClient.OrdenInfo(
                inv.getArgument(0), "PENDIENTE_PAGO", "RECOJO", new BigDecimal("45.50"), null, LocalDateTime.now()));
        when(mercadoPagoGateway.crearPreferencia(any(IniciarPagoRequest.class), any())).thenAnswer(inv -> {
            IniciarPagoRequest r = inv.getArgument(0);
            return new PreferenceResponse("PREF-" + r.ordenId(), "https://mp/init", null, 1L, r.ordenId());
        });
    }

    @AfterEach
    void tearDown() {
        pagoRepository.deleteAll();
    }

    private HttpHeaders headersCliente(long userId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder()
                .subject("cliente@polleria.com")
                .claim("role", "CLIENTE")
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(key)
                .compact();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }

    private static IniciarPagoRequest request(long ordenId, String monto) {
        return new IniciarPagoRequest(ordenId, new BigDecimal(monto), MetodoPago.TARJETA, null, null);
    }

    @Test
    @DisplayName("T3: un invitado sin JWT crea la preferencia (201) como cliente anónimo")
    void invitado_creaPreferencia() {
        ResponseEntity<PreferenceResponse> resp =
                restTemplate.postForEntity(URL, request(7101L, "45.50"), PreferenceResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().preferenceId()).isEqualTo("PREF-7101");
        verify(mercadoPagoGateway).crearPreferencia(any(IniciarPagoRequest.class), eq(0L));
    }

    @Test
    @DisplayName("T3: un invitado no puede crear la preferencia de una orden que ya no espera pago (409)")
    void invitado_ordenNoPendiente_409() {
        when(ordenesClient.obtener(7102L)).thenReturn(new OrdenesClient.OrdenInfo(
                7102L, "CANCELADO", "RECOJO", new BigDecimal("45.50"), null, LocalDateTime.now()));

        ResponseEntity<String> resp = restTemplate.postForEntity(URL, request(7102L, "45.50"), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("T3: un invitado no puede declarar un monto distinto al total (400)")
    void invitado_montoDistinto_400() {
        ResponseEntity<String> resp = restTemplate.postForEntity(URL, request(7103L, "1.00"), String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("PRESERVE T3: un CLIENTE logueado sigue creando la preferencia con su clienteId")
    void clienteLogueado_creaPreferencia() {
        ResponseEntity<PreferenceResponse> resp = restTemplate.exchange(URL, HttpMethod.POST,
                new HttpEntity<>(request(7104L, "45.50"), headersCliente(321L)), PreferenceResponse.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(mercadoPagoGateway).crearPreferencia(any(IniciarPagoRequest.class), eq(321L));
    }

    @Test
    @DisplayName("PRESERVE T3: abrir la preferencia no abre POST /pagos a invitados")
    void invitado_iniciarPago_sigueCerrado() {
        ResponseEntity<String> resp = restTemplate.postForEntity("/pagos", request(7105L, "45.50"), String.class);

        assertThat(resp.getStatusCode().value()).isIn(401, 403);
    }
}
