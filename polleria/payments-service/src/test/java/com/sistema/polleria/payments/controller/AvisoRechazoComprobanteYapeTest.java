package com.sistema.polleria.payments.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.WhatsappNotificationClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * T6d (S6/S13) — Cuando el administrador rechaza el comprobante de Yape, el cliente recibe un aviso
 * por WhatsApp. El rechazo de T6c deja el pedido impago esperando un comprobante válido y el aviso
 * es lo único que cierra el circuito.
 *
 * <p>Se ejerce por HTTP real contra PostgreSQL (perfil test, puerto 5433), igual que
 * {@code VerificarComprobanteYapeTest}. El aviso se comprueba sobre
 * {@link WhatsappNotificationClient} mockeado: el HTTP real lo resuelve ese cliente (que apunta al
 * notification-service), que es exactamente el mismo que usa el pago aprobado de Mercado Pago.
 *
 * <p><b>Orden garantizado:</b> el aviso se encola **después de que el rechazo quedó confirmado**
 * (after-commit), así que una falla del notification-service no puede revertir la transacción ni
 * romper la respuesta al admin. El test (b) lo comprueba con una **conexión nueva a la base**, que
 * solo ve datos ya comprometidos.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "internal.api-key=clave-interna-aviso-rechazo")
@ActiveProfiles("test")
class AvisoRechazoComprobanteYapeTest {

    private static final String CLAVE_INTERNA = "clave-interna-aviso-rechazo";
    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String ADMIN_EMAIL = "admin.aviso@prueba.local";
    private static final long ADMIN_ID = 951L;

    private static final String JDBC = "jdbc:postgresql://localhost:5433/polleria_test";
    private static final String DB_USUARIO = "postgres";
    private static final String DB_CLAVE = "postgres123";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    private final List<Long> pagosCreados = new ArrayList<>();

    @AfterEach
    void limpiar() {
        pagosCreados.forEach(id -> pagoRepository.deleteById(id));
        pagosCreados.clear();
    }

    @Test
    @DisplayName("T6d (a): rechazar dispara el aviso al cliente con la orden y el motivo, y el pago queda RECHAZADO")
    void rechazarDisparaElAvisoConLaOrdenYElMotivo() throws Exception {
        long ordenId = 979201L;
        String motivo = "El monto no coincide con el total del pedido";
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/979201/rechazado.jpg");

        ResponseEntity<String> respuesta = verificar(pagoId, rechazo(motivo));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("RECHAZADO");

        verify(whatsappNotificationClient, times(1))
                .notificarComprobanteRechazado(eq(ordenId), eq(motivo));

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.RECHAZADO);
        assertThat(pago.getMotivoRechazo()).isEqualTo(motivo);
    }

    @Test
    @DisplayName("T6d (b): el aviso se dispara recién cuando el rechazo ya está confirmado en la base")
    void elAvisoSeDisparaConElRechazoYaGuardado() throws Exception {
        long ordenId = 979202L;
        String motivo = "El comprobante está borroso";
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/979202/borroso.jpg");

        // Una conexión nueva solo ve datos comprometidos: si el aviso saliera antes del commit,
        // leería el estado anterior (PENDIENTE_VERIFICACION).
        AtomicReference<String> estadoAlAvisar = new AtomicReference<>();
        doAnswer(invocacion -> {
            Long orden = invocacion.getArgument(0);
            estadoAlAvisar.set(estadoEnBaseDeDatos(orden));
            return null;
        }).when(whatsappNotificationClient).notificarComprobanteRechazado(anyLong(), anyString());

        ResponseEntity<String> respuesta = verificar(pagoId, rechazo(motivo));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(estadoAlAvisar.get()).isEqualTo("RECHAZADO");
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado())
                .isEqualTo(EstadoPago.RECHAZADO);
    }

    @Test
    @DisplayName("T6d (c): si el aviso falla, el pago igual queda RECHAZADO y la respuesta al admin no se rompe")
    void siElAvisoFallaElRechazoIgualQuedaGuardado() throws Exception {
        long ordenId = 979203L;
        String motivo = "Comprobante de otra persona";
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/979203/ajeno.jpg");

        doThrow(new RuntimeException("notification-service no disponible"))
                .when(whatsappNotificationClient).notificarComprobanteRechazado(anyLong(), anyString());

        ResponseEntity<String> respuesta = verificar(pagoId, rechazo(motivo));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("RECHAZADO");

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.RECHAZADO);
        assertThat(pago.getMotivoRechazo()).isEqualTo(motivo);

        // Se intentó avisar una sola vez (no se reintenta dentro de la transacción).
        verify(whatsappNotificationClient, times(1))
                .notificarComprobanteRechazado(eq(ordenId), eq(motivo));
    }

    @Test
    @DisplayName("T6d (d): aprobar no dispara el aviso de rechazo")
    void aprobarNoDisparaElAvisoDeRechazo() throws Exception {
        long ordenId = 979204L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/979204/aprobado.jpg");

        ResponseEntity<String> respuesta = verificar(pagoId, "{\"aprobado\": true}");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(respuesta.getBody()).path("estado").asText())
                .isEqualTo("APROBADO");
        verify(whatsappNotificationClient, never())
                .notificarComprobanteRechazado(anyLong(), anyString());
    }

    @Test
    @DisplayName("PRESERVE: rechazar sin motivo sigue respondiendo 400, no cambia el pago y no avisa")
    void rechazarSinMotivoSigueRespondiendo400() throws Exception {
        long ordenId = 979205L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/979205/sin-motivo.jpg");

        ResponseEntity<String> respuesta = verificar(pagoId, "{\"aprobado\": false}");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        assertThat(pago.getMotivoRechazo()).isNull();
        verify(whatsappNotificationClient, never())
                .notificarComprobanteRechazado(anyLong(), anyString());
    }

    // ─── util ───────────────────────────────────────────────────────

    private static String rechazo(String motivo) {
        return "{\"aprobado\": false, \"motivoRechazo\": \"" + motivo + "\"}";
    }

    private String estadoEnBaseDeDatos(long ordenId) throws Exception {
        try (Connection c = DriverManager.getConnection(JDBC, DB_USUARIO, DB_CLAVE);
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT estado FROM pagos WHERE orden_id = " + ordenId)) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private long registrarComprobante(long ordenId, String clave) throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Key", CLAVE_INTERNA);
        String json = """
                {"ordenId": %d, "monto": 45.50, "comprobanteClave": "%s"}
                """.formatted(ordenId, clave);

        ResponseEntity<String> respuesta = rest.exchange("/pagos/comprobante", HttpMethod.POST,
                new HttpEntity<>(json, headers), String.class);
        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        long pagoId = objectMapper.readTree(respuesta.getBody()).path("id").asLong();
        pagosCreados.add(pagoId);
        return pagoId;
    }

    private ResponseEntity<String> verificar(long pagoId, String json) {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(tokenAdmin());
        return rest.exchange("/pagos/" + pagoId + "/verificar", HttpMethod.POST,
                new HttpEntity<>(json, headers), String.class);
    }

    private String tokenAdmin() {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(ADMIN_EMAIL)
                .claim("role", "ADMIN")
                .claim("userId", ADMIN_ID)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }

    private boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(JDBC, DB_USUARIO, DB_CLAVE)) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
