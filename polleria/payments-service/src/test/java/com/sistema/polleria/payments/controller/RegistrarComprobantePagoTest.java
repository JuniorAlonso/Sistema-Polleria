package com.sistema.polleria.payments.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.payments.repository.PagoRepository;
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

import java.sql.Connection;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T6a (S6) — El notification-service registra la evidencia de un pago por Yape hecho por
 * WhatsApp y el pago queda esperando la verificación del administrador. El endpoint es interno
 * (X-Internal-Key, el mismo patrón entre microservicios del proyecto) y solo guarda la
 * referencia opaca al comprobante: el archivo lo sube el notification-service (T6b).
 *
 * Se ejerce por HTTP real contra PostgreSQL (perfil test, puerto 5433), igual que
 * {@code PagoConfirmacionConcurrenteTest}: el estado y la clave se comprueban sobre la
 * respuesta pública y el repositorio, no sobre campos internos de la entidad.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "internal.api-key=clave-interna-de-prueba-comprobante")
@ActiveProfiles("test")
class RegistrarComprobantePagoTest {

    private static final String CLAVE_INTERNA = "clave-interna-de-prueba-comprobante";
    private static final String RUTA = "/pagos/comprobante";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private Long pagoIdCreado;

    @AfterEach
    void limpiar() {
        if (pagoIdCreado != null) {
            pagoRepository.deleteById(pagoIdCreado);
        }
    }

    @Test
    @DisplayName("T6a: registrar el comprobante crea el pago YAPE_PLIN pendiente de verificación")
    void registrarElComprobanteCreaElPagoYapePendienteDeVerificacion() throws Exception {
        long ordenId = 976001L;

        ResponseEntity<String> respuesta = registrar(
                cuerpo(ordenId, "\"999888777\"", "45.50", "\"comprobantes/yape/976001.jpg\""),
                CLAVE_INTERNA);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(respuesta.getBody());
        pagoIdCreado = body.path("id").asLong();
        assertThat(body.path("metodoPago").asText()).isEqualTo("YAPE_PLIN");
        assertThat(body.path("estado").asText()).isEqualTo("PENDIENTE_VERIFICACION");
        assertThat(body.path("comprobanteClave").asText()).isEqualTo("comprobantes/yape/976001.jpg");

        assertThat(pagoRepository.findByOrdenId(ordenId)).isPresent();
    }

    @Test
    @DisplayName("T6a: sin X-Internal-Key el endpoint responde 401")
    void sinClaveInternaResponde401() {
        ResponseEntity<String> respuesta = registrar(
                cuerpo(976002L, "null", "45.50", "\"comprobantes/yape/976002.jpg\""), null);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(pagoRepository.findByOrdenId(976002L)).isEmpty();
    }

    @Test
    @DisplayName("T6a: con una X-Internal-Key inválida el endpoint responde 401")
    void conClaveInternaInvalidaResponde401() {
        ResponseEntity<String> respuesta = registrar(
                cuerpo(976003L, "null", "45.50", "\"comprobantes/yape/976003.jpg\""), "clave-mala");

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(pagoRepository.findByOrdenId(976003L)).isEmpty();
    }

    @Test
    @DisplayName("T6a: sin ordenId responde 400 y no crea ningún pago")
    void sinOrdenIdResponde400YNoCreaNada() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");
        long antes = pagoRepository.count();

        ResponseEntity<String> respuesta = registrar(
                "{\"comprobanteClave\":\"comprobantes/yape/sin-orden.jpg\"}", CLAVE_INTERNA);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(pagoRepository.count()).isEqualTo(antes);
    }

    @Test
    @DisplayName("T6a: con un ordenId inválido responde 400 y no crea ningún pago")
    void conOrdenIdInvalidoResponde400YNoCreaNada() {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");
        long antes = pagoRepository.count();

        ResponseEntity<String> respuesta = registrar(
                cuerpo(-5L, "null", "45.50", "\"comprobantes/yape/976004.jpg\""), CLAVE_INTERNA);

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(pagoRepository.count()).isEqualTo(antes);
    }

    @Test
    @DisplayName("T6a: dos registros de la misma orden no duplican el pago y reemplazan el comprobante")
    void dosRegistrosDeLaMismaOrdenNoDuplicanElPago() throws Exception {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");
        long ordenId = 976005L;
        long antes = pagoRepository.count();

        ResponseEntity<String> primero = registrar(
                cuerpo(ordenId, "null", "60.00", "\"comprobantes/yape/primero.jpg\""), CLAVE_INTERNA);
        assertThat(primero.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode primerBody = objectMapper.readTree(primero.getBody());
        pagoIdCreado = primerBody.path("id").asLong();

        ResponseEntity<String> segundo = registrar(
                cuerpo(ordenId, "null", "60.00", "\"comprobantes/yape/segundo.jpg\""), CLAVE_INTERNA);
        assertThat(segundo.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode segundoBody = objectMapper.readTree(segundo.getBody());

        assertThat(segundoBody.path("id").asLong()).isEqualTo(pagoIdCreado);
        assertThat(segundoBody.path("comprobanteClave").asText())
                .isEqualTo("comprobantes/yape/segundo.jpg");
        assertThat(pagoRepository.count()).isEqualTo(antes + 1);
        assertThat(pagoRepository.findByOrdenId(ordenId)).isPresent();
    }

    // ─── util ───────────────────────────────────────────────────────

    private ResponseEntity<String> registrar(String json, String claveInterna) {
        Assumptions.assumeTrue(postgresDisponible(),
                "PostgreSQL de pruebas no disponible en localhost:5433");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (claveInterna != null) {
            headers.set("X-Internal-Key", claveInterna);
        }
        return rest.exchange(RUTA, HttpMethod.POST, new HttpEntity<>(json, headers), String.class);
    }

    private String cuerpo(long ordenId, String telefonoJson, String montoJson, String claveJson) {
        return """
                {"ordenId": %d, "telefono": %s, "monto": %s, "comprobanteClave": %s}
                """.formatted(ordenId, telefonoJson, montoJson, claveJson);
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
