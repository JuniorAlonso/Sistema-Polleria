package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.YapeOtpPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.NotificadorOrden;
import com.sistema.polleria.payments.service.WhatsappNotificationClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("Auditoría de Casos Límite: Yape OTP y Validaciones Estrictas")
class YapeOtpEdgeCasesTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PagoRepository pagoRepository;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    @MockitoBean
    private NotificadorOrden notificadorOrden;

    @AfterEach
    void tearDown() {
        pagoRepository.deleteAll();
    }

    @Test
    @DisplayName("Caso Normal: Yape OTP con 6 dígitos y celular peruano válido -> APROBADO")
    void testYapeOtpValido_aprueba() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5501L, new BigDecimal("45.50"), "987654321", "123456", "cliente@test.com");

        ResponseEntity<PagoResponse> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, PagoResponse.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals(EstadoPago.APROBADO, resp.getBody().estado());
    }

    @Test
    @DisplayName("Caso Límite: OTP de 5 dígitos es rechazado con 400 Bad Request por Bean Validation")
    void testYapeOtp5Digitos_rechazaCon400() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5502L, new BigDecimal("45.50"), "987654321", "12345", "cliente@test.com");

        ResponseEntity<String> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, String.class);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("Caso Límite: OTP con letras es rechazado con 400 Bad Request")
    void testYapeOtpConLetras_rechazaCon400() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5503L, new BigDecimal("45.50"), "987654321", "ABCDEF", "cliente@test.com");

        ResponseEntity<String> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, String.class);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("Caso Límite: Celular que no empieza con 9 es rechazado con 400 Bad Request")
    void testCelularNoEmpiezaCon9_rechazaCon400() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5504L, new BigDecimal("45.50"), "123456789", "123456", "cliente@test.com");

        ResponseEntity<String> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, String.class);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("Caso Límite: Monto negativo o cero es rechazado con 400 Bad Request")
    void testMontoCero_rechazaCon400() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5505L, BigDecimal.ZERO, "987654321", "123456", "cliente@test.com");

        ResponseEntity<String> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, String.class);

        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }

    @Test
    @DisplayName("Caso Límite: OTP '000000' (código inválido/expirado) devuelve RECHAZADO")
    void testOtp000000_devuelveRechazado() {
        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                5506L, new BigDecimal("45.50"), "987654321", "000000", "cliente@test.com");

        ResponseEntity<PagoResponse> resp = restTemplate.postForEntity(
                "/pagos/yape-otp", req, PagoResponse.class);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        assertNotNull(resp.getBody());
        assertEquals(EstadoPago.RECHAZADO, resp.getBody().estado());
    }
}
