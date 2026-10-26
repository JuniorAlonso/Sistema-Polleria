package com.sistema.polleria.payments.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.NotificadorOrden;
import com.sistema.polleria.payments.service.OrdenesClient;
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
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * T6c (S6) — La verificación del comprobante de Yape es exclusiva del rol {@code ADMIN} y es la
 * única puerta por la que un pedido pagado por Yape avanza.
 *
 * <p>Se ejerce por HTTP real contra PostgreSQL (perfil test, puerto 5433), igual que
 * {@code RegistrarComprobantePagoTest}: el estado, quién verificó y cuándo se comprueban contra el
 * repositorio, no contra campos internos de la respuesta.
 *
 * <p>El avance de la orden se comprueba sobre {@link NotificadorOrden}, que es **el mismo
 * mecanismo** que usa el pago aprobado de Mercado Pago ({@code PagoService.confirmar}): una
 * aprobación de Yape tiene que disparar exactamente esa notificación y un rechazo ninguna. La
 * llamada real a {@code orders-service} queda fuera del alcance de T6c (ver L16: T6c es el backend
 * de {@code payments-service}); aquí {@code orders.service.url} apunta a un puerto muerto, así que
 * sin el mock el efecto no sería observable.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "internal.api-key=clave-interna-verificacion-yape")
@ActiveProfiles("test")
class VerificarComprobanteYapeTest {

    private static final String CLAVE_INTERNA = "clave-interna-verificacion-yape";
    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final String ADMIN_EMAIL = "admin.verificador@prueba.local";
    private static final long ADMIN_ID = 941L;
    private static final long OTRO_ID = 942L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private NotificadorOrden notificadorOrden;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    /** Unstubbed: returns null, so the verification window falls back to the pago creation time. */
    @MockitoBean
    private OrdenesClient ordenesClient;

    private final List<Long> pagosCreados = new ArrayList<>();

    @AfterEach
    void limpiar() {
        pagosCreados.forEach(id -> pagoRepository.deleteById(id));
        pagosCreados.clear();
    }

    @Test
    @DisplayName("T6c (a): un ADMIN aprueba → pago APROBADO con verificadoPor/verificadoEn y la orden avanza")
    void adminApruebaYLaOrdenAvanza() throws Exception {
        long ordenId = 978101L;
        String clave = "comprobantes/yape/978101/aprobado.jpg";
        long pagoId = registrarComprobante(ordenId, clave);

        ResponseEntity<String> respuesta = verificar(pagoId, "{\"aprobado\": true}", tokenAdmin());

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("APROBADO");

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(pago.getVerificadoPor()).isEqualTo(ADMIN_EMAIL);
        assertThat(pago.getVerificadoEn()).isNotNull();
        assertThat(pago.getMotivoRechazo()).isNull();

        // Mismo mecanismo que el pago aprobado de Mercado Pago (PagoService.confirmar).
        verify(notificadorOrden, times(1))
                .notificarPagoAprobado(eq(ordenId), anyString());
        verify(whatsappNotificationClient, times(1))
                .notificarPagoConfirmado(eq(ordenId), any(), eq(MetodoPago.YAPE_PLIN));
    }

    @Test
    @DisplayName("T6c (b): un ADMIN rechaza con motivo → pago RECHAZADO, motivo guardado y la orden NO avanza")
    void adminRechazaConMotivoYLaOrdenNoAvanza() throws Exception {
        long ordenId = 978102L;
        String motivo = "El monto no coincide con el total del pedido";
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978102/rechazado.jpg");

        ResponseEntity<String> respuesta = verificar(
                pagoId,
                "{\"aprobado\": false, \"motivoRechazo\": \"" + motivo + "\"}",
                tokenAdmin());

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("RECHAZADO");

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.RECHAZADO);
        assertThat(pago.getMotivoRechazo()).isEqualTo(motivo);
        assertThat(pago.getVerificadoPor()).isEqualTo(ADMIN_EMAIL);
        assertThat(pago.getVerificadoEn()).isNotNull();

        // El rechazo deja el pedido impago esperando un comprobante válido: no lo avanza.
        verify(notificadorOrden, never()).notificarPagoAprobado(anyLong(), anyString());
    }

    @Test
    @DisplayName("T6c (c): con un rol que no es ADMIN ni CAJERO (o sin token) responde 403/401 y el pago no cambia")
    void sinTokenDeAdminNoSePuedeVerificar() throws Exception {
        long ordenId = 978103L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978103/ajeno.jpg");

        ResponseEntity<String> comoMozo = verificar(
                pagoId, "{\"aprobado\": true}", token(OTRO_ID, "MOZO", "mozo@prueba.local"));
        assertThat(comoMozo.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        ResponseEntity<String> comoCliente = verificar(
                pagoId, "{\"aprobado\": true}", token(944L, "CLIENTE", "cliente@prueba.local"));
        assertThat(comoCliente.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        ResponseEntity<String> sinToken = verificar(pagoId, "{\"aprobado\": true}", null);
        assertThat(sinToken.getStatusCode())
                .isIn(HttpStatus.FORBIDDEN, HttpStatus.UNAUTHORIZED);

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        assertThat(pago.getVerificadoPor()).isNull();
        assertThat(pago.getVerificadoEn()).isNull();
        verify(notificadorOrden, never()).notificarPagoAprobado(anyLong(), anyString());
    }

    @Test
    @DisplayName("T6c (d): rechazar sin motivo (o con motivo en blanco) responde 400 y el pago no cambia")
    void rechazarSinMotivoResponde400YNoCambiaElPago() throws Exception {
        long ordenId = 978104L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978104/sin-motivo.jpg");

        ResponseEntity<String> sinMotivo = verificar(pagoId, "{\"aprobado\": false}", tokenAdmin());
        assertThat(sinMotivo.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<String> motivoEnBlanco = verificar(
                pagoId, "{\"aprobado\": false, \"motivoRechazo\": \"   \"}", tokenAdmin());
        assertThat(motivoEnBlanco.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        assertThat(pago.getMotivoRechazo()).isNull();
        assertThat(pago.getVerificadoPor()).isNull();
        verify(notificadorOrden, never()).notificarPagoAprobado(anyLong(), anyString());
    }

    @Test
    @DisplayName("T6c (e1): un comprobante nuevo reemplaza a uno RECHAZADO y vuelve a PENDIENTE_VERIFICACION")
    void unComprobanteNuevoReemplazaAUnoRechazado() throws Exception {
        long ordenId = 978105L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978105/primero.jpg");

        ResponseEntity<String> rechazo = verificar(
                pagoId, "{\"aprobado\": false, \"motivoRechazo\": \"El monto no coincide\"}", tokenAdmin());
        assertThat(rechazo.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado())
                .isEqualTo(EstadoPago.RECHAZADO);

        // El cliente vuelve a mandar su comprobante: la evidencia rechazada no puede dejar el
        // pedido imposible de pagar por Yape (el índice único impide un segundo pago por orden).
        ResponseEntity<String> reintento = registrarComprobanteRespuesta(
                ordenId, "comprobantes/yape/978105/reintento.jpg");

        assertThat(reintento.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(reintento.getBody());
        assertThat(body.path("id").asLong()).isEqualTo(pagoId);
        assertThat(body.path("estado").asText()).isEqualTo("PENDIENTE_VERIFICACION");
        assertThat(body.path("comprobanteClave").asText())
                .isEqualTo("comprobantes/yape/978105/reintento.jpg");

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        assertThat(pago.getComprobanteClave()).isEqualTo("comprobantes/yape/978105/reintento.jpg");
        assertThat(pago.getVerificadoPor()).isNull();
        assertThat(pago.getVerificadoEn()).isNull();
        assertThat(pago.getMotivoRechazo()).isNull();
        assertThat(pagoRepository.findByOrdenId(ordenId)).isPresent();
    }

    @Test
    @DisplayName("T6c (e2): un comprobante nuevo NO reemplaza a uno APROBADO")
    void unComprobanteNuevoNoReemplazaAUnoAprobado() throws Exception {
        long ordenId = 978106L;
        String claveOriginal = "comprobantes/yape/978106/aprobado.jpg";
        long pagoId = registrarComprobante(ordenId, claveOriginal);

        ResponseEntity<String> aprobacion = verificar(pagoId, "{\"aprobado\": true}", tokenAdmin());
        assertThat(aprobacion.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> otro = registrarComprobanteRespuesta(
                ordenId, "comprobantes/yape/978106/otro.jpg");

        assertThat(otro.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(otro.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("APROBADO");
        assertThat(body.path("comprobanteClave").asText()).isEqualTo(claveOriginal);

        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(pago.getComprobanteClave()).isEqualTo(claveOriginal);
    }

    @Test
    @DisplayName("T6c (f): la URL firmada se entrega solo a un ADMIN; otro rol no ve la clave ni la URL")
    void laUrlFirmadaSeGeneraSoloParaAdmin() throws Exception {
        long ordenId = 978107L;
        String clave = "comprobantes/yape/978107/978107-abc.jpg";
        long pagoId = registrarComprobante(ordenId, clave);

        ResponseEntity<String> comoAdmin = obtener("/pagos/" + pagoId, tokenAdmin());
        assertThat(comoAdmin.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode admin = objectMapper.readTree(comoAdmin.getBody());
        assertThat(admin.path("comprobanteClave").asText()).isEqualTo(clave);
        String url = admin.path("comprobanteUrl").asText();
        assertThat(url).startsWith("http");
        assertThat(url).contains("polleria-comprobantes");
        assertThat(url).contains("X-Amz-Signature");

        ResponseEntity<String> comoMozo = obtener(
                "/pagos/orden/" + ordenId, token(OTRO_ID, "MOZO", "mozo@prueba.local"));
        assertThat(comoMozo.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode mozo = objectMapper.readTree(comoMozo.getBody());
        assertThat(mozo.path("ordenId").asLong()).isEqualTo(ordenId);
        assertThat(mozo.path("estado").asText()).isEqualTo("PENDIENTE_VERIFICACION");
        assertThat(mozo.path("comprobanteClave").asText(null)).isNull();
        assertThat(mozo.path("comprobanteUrl").asText(null)).isNull();
    }

    @Test
    @DisplayName("PRESERVE: el detalle de un pago sin comprobante sigue igual para un MOZO")
    void unPagoSinComprobanteSigueVisibleParaElMozo() throws Exception {
        long ordenId = 978108L;
        String tokenMozo = token(OTRO_ID, "MOZO", "mozo@prueba.local");

        ResponseEntity<String> alta = rest.exchange(
                "/pagos",
                HttpMethod.POST,
                entidadJson("{\"ordenId\": " + ordenId + ", \"monto\": 42.50, \"metodoPago\": \"CONTRAENTREGA\"}",
                        tokenMozo),
                String.class);
        assertThat(alta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long pagoId = objectMapper.readTree(alta.getBody()).path("id").asLong();
        pagosCreados.add(pagoId);

        ResponseEntity<String> detalle = obtener("/pagos/" + pagoId, tokenMozo);
        assertThat(detalle.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(detalle.getBody());
        assertThat(body.path("ordenId").asLong()).isEqualTo(ordenId);
        assertThat(body.path("monto").asDouble()).isEqualTo(42.50);
        assertThat(body.path("estado").asText()).isEqualTo("PENDIENTE");
        assertThat(body.path("comprobanteClave").asText(null)).isNull();
        assertThat(body.path("comprobanteUrl").asText(null)).isNull();
    }

    @Test
    @DisplayName("PRESERVE: cancelar un pago sigue funcionando para un CLIENTE y no le entrega la clave")
    void cancelarSigueFuncionandoYNoExponeLaClave() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");
        long ordenId = 978109L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978109/cancelado.jpg");
        String tokenCliente = token(944L, "CLIENTE", "cliente@prueba.local");

        ResponseEntity<String> respuesta = rest.exchange(
                "/pagos/" + pagoId + "/cancelar",
                HttpMethod.PATCH,
                entidadSinCuerpo(tokenCliente),
                String.class);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("CANCELADO");
        assertThat(body.path("comprobanteClave").asText(null)).isNull();
        assertThat(body.path("comprobanteUrl").asText(null)).isNull();
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado())
                .isEqualTo(EstadoPago.CANCELADO);
    }

    @Test
    @DisplayName("S3: un CAJERO aprueba dentro de la ventana → APROBADO, verificadoPor y la orden avanza")
    void cajeroApruebaDentroDeLaVentana() throws Exception {
        long ordenId = 978110L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978110/cajero.jpg");

        ResponseEntity<String> respuesta = verificar(
                pagoId, "{\"aprobado\": true}", token(OTRO_ID, "CAJERO", "cajero@prueba.local"));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        Pago pago = pagoRepository.findById(pagoId).orElseThrow();
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(pago.getVerificadoPor()).isEqualTo("cajero@prueba.local");
        verify(notificadorOrden, times(1)).notificarPagoAprobado(eq(ordenId), anyString());
    }

    @Test
    @DisplayName("S3: aprobar un pago sin captura adjunta responde 400 y no cambia el pago ni avanza la orden")
    void aprobarSinCapturaResponde400() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(), "PostgreSQL de pruebas no disponible en localhost:5433");
        Pago sinCaptura = new Pago();
        sinCaptura.setOrdenId(978111L);
        sinCaptura.setClienteId(944L);
        sinCaptura.setMonto(new java.math.BigDecimal("30.00"));
        sinCaptura.setMetodoPago(MetodoPago.YAPE_PLIN);
        sinCaptura.setEstado(EstadoPago.PENDIENTE_VERIFICACION);
        long pagoId = pagoRepository.saveAndFlush(sinCaptura).getId();
        pagosCreados.add(pagoId);

        ResponseEntity<String> respuesta = verificar(
                pagoId, "{\"aprobado\": true}", token(OTRO_ID, "CAJERO", "cajero@prueba.local"));

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(respuesta.getBody()).contains("captura");
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado())
                .isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        verify(notificadorOrden, never()).notificarPagoAprobado(anyLong(), anyString());
    }

    @Test
    @DisplayName("S3: aprobar pasados los 15 minutos de la orden responde 400; rechazar sigue permitido")
    void aprobarFueraDeVentanaResponde400PeroRechazarSiPermite() throws Exception {
        long ordenId = 978112L;
        long pagoId = registrarComprobante(ordenId, "comprobantes/yape/978112/tarde.jpg");
        org.mockito.Mockito.when(ordenesClient.obtener(ordenId)).thenReturn(new OrdenesClient.OrdenInfo(
                ordenId, "PENDIENTE_PAGO", "DELIVERY", new java.math.BigDecimal("45.50"), 944L,
                java.time.LocalDateTime.now().minusMinutes(16)));
        String tokenCajero = token(OTRO_ID, "CAJERO", "cajero@prueba.local");

        ResponseEntity<String> aprobar = verificar(pagoId, "{\"aprobado\": true}", tokenCajero);

        assertThat(aprobar.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(aprobar.getBody()).contains("15 minutos");
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado())
                .isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        verify(notificadorOrden, never()).notificarPagoAprobado(anyLong(), anyString());

        ResponseEntity<String> rechazar = verificar(
                pagoId, "{\"aprobado\": false, \"motivoRechazo\": \"Captura ilegible\"}", tokenCajero);
        assertThat(rechazar.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pagoRepository.findById(pagoId).orElseThrow().getEstado()).isEqualTo(EstadoPago.RECHAZADO);
    }

    // ─── util ───────────────────────────────────────────────────────

    private long registrarComprobante(long ordenId, String clave) throws Exception {
        ResponseEntity<String> respuesta = registrarComprobanteRespuesta(ordenId, clave);
        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        long pagoId = objectMapper.readTree(respuesta.getBody()).path("id").asLong();
        pagosCreados.add(pagoId);
        return pagoId;
    }

    private ResponseEntity<String> registrarComprobanteRespuesta(long ordenId, String clave) {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Internal-Key", CLAVE_INTERNA);
        String json = """
                {"ordenId": %d, "monto": 45.50, "comprobanteClave": "%s"}
                """.formatted(ordenId, clave);
        return rest.exchange("/pagos/comprobante", HttpMethod.POST,
                new HttpEntity<>(json, headers), String.class);
    }

    private ResponseEntity<String> verificar(long pagoId, String json, String bearer) {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (bearer != null) {
            headers.setBearerAuth(bearer);
        }
        return rest.exchange("/pagos/" + pagoId + "/verificar", HttpMethod.POST,
                new HttpEntity<>(json, headers), String.class);
    }

    private ResponseEntity<String> obtener(String ruta, String bearer) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        return rest.exchange(ruta, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private HttpEntity<String> entidadJson(String json, String bearer) {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(bearer);
        return new HttpEntity<>(json, headers);
    }

    private HttpEntity<Void> entidadSinCuerpo(String bearer) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        return new HttpEntity<>(headers);
    }

    private String tokenAdmin() {
        return token(ADMIN_ID, "ADMIN", ADMIN_EMAIL);
    }

    private String token(long userId, String rol, String email) {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(email)
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }

    private boolean postgresDisponible() {
        try (Connection c = DriverManager.getConnection(
                "jdbc:postgresql://localhost:5433/polleria_test", "postgres", "postgres123")) {
            return c.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
