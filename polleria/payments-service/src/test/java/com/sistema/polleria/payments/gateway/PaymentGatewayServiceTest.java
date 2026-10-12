package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.entity.MetodoPago;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class PaymentGatewayServiceTest {

    @Mock
    private ContraentregaGateway contraentregaGateway;

    @Mock
    private TarjetaGateway tarjetaMockGateway;

    @Mock
    private YapePlinGateway yapePlinMockGateway;

    @Mock
    private MercadoPagoGateway mercadoPagoGateway;

    @Test
    @DisplayName("Debe seleccionar ContraentregaGateway cuando metodo es CONTRAENTREGA")
    void seleccionar_contraentrega() {
        PaymentGatewayService service = new PaymentGatewayService(
                contraentregaGateway, tarjetaMockGateway, yapePlinMockGateway, mercadoPagoGateway
        );

        PaymentGateway result = service.seleccionar(MetodoPago.CONTRAENTREGA);
        assertThat(result).isSameAs(contraentregaGateway);
    }

    @Test
    @DisplayName("Debe seleccionar MercadoPagoGateway para TARJETA cuando token MP está configurado")
    void seleccionar_tarjetaConMercadoPago() {
        PaymentGatewayService service = new PaymentGatewayService(
                contraentregaGateway, tarjetaMockGateway, yapePlinMockGateway, mercadoPagoGateway
        );
        ReflectionTestUtils.setField(service, "mpAccessToken", "APP_USR-123456");

        PaymentGateway result = service.seleccionar(MetodoPago.TARJETA);
        assertThat(result).isSameAs(mercadoPagoGateway);
    }

    @Test
    @DisplayName("Debe seleccionar TarjetaGateway mock cuando token MP está vacío")
    void seleccionar_tarjetaMockFallback() {
        PaymentGatewayService service = new PaymentGatewayService(
                contraentregaGateway, tarjetaMockGateway, yapePlinMockGateway, mercadoPagoGateway
        );
        ReflectionTestUtils.setField(service, "mpAccessToken", "");

        PaymentGateway result = service.seleccionar(MetodoPago.TARJETA);
        assertThat(result).isSameAs(tarjetaMockGateway);
    }

    @Test
    @DisplayName("Debe seleccionar MercadoPagoGateway para YAPE_PLIN cuando token MP está configurado")
    void seleccionar_yapeConMercadoPago() {
        PaymentGatewayService service = new PaymentGatewayService(
                contraentregaGateway, tarjetaMockGateway, yapePlinMockGateway, mercadoPagoGateway
        );
        ReflectionTestUtils.setField(service, "mpAccessToken", "APP_USR-valid-token");

        PaymentGateway result = service.seleccionar(MetodoPago.YAPE_PLIN);
        assertThat(result).isSameAs(mercadoPagoGateway);
    }

    @Test
    @DisplayName("Debe seleccionar YapePlinGateway mock cuando token MP está vacío")
    void seleccionar_yapeMockFallback() {
        PaymentGatewayService service = new PaymentGatewayService(
                contraentregaGateway, tarjetaMockGateway, yapePlinMockGateway, mercadoPagoGateway
        );
        ReflectionTestUtils.setField(service, "mpAccessToken", null);

        PaymentGateway result = service.seleccionar(MetodoPago.YAPE_PLIN);
        assertThat(result).isSameAs(yapePlinMockGateway);
    }
}
