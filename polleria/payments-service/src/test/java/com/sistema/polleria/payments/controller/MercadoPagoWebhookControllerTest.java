
package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.PagoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MercadoPagoWebhookControllerTest {

    @Mock
    private PagoRepository pagoRepository;

    @Mock
    private PagoService pagoService;

    @InjectMocks
    private MercadoPagoWebhookController controller;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(controller, "webhookSecret", "");
    }

    @Test
    @DisplayName("Debe procesar webhook ignorando consulta externa si no hay paymentId y responder 200 OK")
    void handleWebhook_sinPaymentId_respondeOk() {
        ResponseEntity<Void> res = controller.handleWebhook(
                null, null, null, null, null, null, Map.of("action", "test"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        verifyNoInteractions(pagoRepository);
        verifyNoInteractions(pagoService);
    }

    @Test
    @DisplayName("Debe rechazar webhook con 401 si secret está configurado y la firma HMAC es inválida")
    void handleWebhook_firmaInvalida_rechazaCon401() {
        ReflectionTestUtils.setField(controller, "webhookSecret", "mi_secreto_super_seguro");

        ResponseEntity<Void> res = controller.handleWebhook(
                "ts=123456,v1=firma_falsa", "req-1", "payment", null, "999", null, null);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(pagoRepository);
    }

    @Test
    @DisplayName("Debe aceptar webhook con 200 si la firma HMAC calculada coincide exactamente")
    void handleWebhook_firmaValida_acepta() throws Exception {
        String secret = "mi_secreto_super_seguro";
        ReflectionTestUtils.setField(controller, "webhookSecret", secret);

        String paymentId = "12345";
        String requestId = "req-xyz";
        String ts = "1700000000";
        String manifest = "id:" + paymentId + ";request-id:" + requestId + ";ts:" + ts + ";";

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(manifest.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash)
            hex.append(String.format("%02x", b));

        String xSignature = "ts=" + ts + ",v1=" + hex.toString();

        ResponseEntity<Void> res = controller.handleWebhook(
                xSignature, requestId, "payment", null, paymentId, null, null);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
