package com.sistema.polleria.payments.gateway;

import com.sistema.polleria.payments.entity.MetodoPago;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Servicio encargado de seleccionar el gateway de pago según el método y configuración (Strategy Pattern).
 * Si Mercado Pago tiene credenciales configuradas, TARJETA y YAPE_PLIN usan MercadoPagoGateway.
 * En caso contrario o para pruebas locales sin credenciales de MP, usa los Mock Gateways.
 * CONTRAENTREGA siempre usa ContraentregaGateway.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentGatewayService {

    private final ContraentregaGateway contraentregaGateway;
    private final TarjetaGateway tarjetaMockGateway;
    private final YapePlinGateway yapePlinMockGateway;
    private final MercadoPagoGateway mercadoPagoGateway;

    @Value("${mercadopago.access-token:}")
    private String mpAccessToken;

    @Value("${payments.mock-gateways.enabled:false}")
    private boolean mockGatewaysEnabled;

    public PaymentGateway seleccionar(MetodoPago metodoPago) {
        boolean mpConfigurado = mpAccessToken != null 
                && !mpAccessToken.isBlank() 
                && !mpAccessToken.contains("TU_ACCESS_TOKEN");

        return switch (metodoPago) {
            case CONTRAENTREGA -> {
                log.debug("Seleccionando ContraentregaGateway");
                yield contraentregaGateway;
            }
            case TARJETA -> {
                if (mpConfigurado) {
                    log.info("Seleccionando pasarela real Mercado Pago para TARJETA");
                    yield mercadoPagoGateway;
                } else if (mockGatewaysEnabled) {
                    log.info("Mercado Pago no configurado; seleccionando TarjetaGateway mock");
                    yield tarjetaMockGateway;
                } else {
                    throw new IllegalStateException(
                            "Pasarela Mercado Pago no configurada en este entorno");
                }
            }
            case YAPE_PLIN -> {
                if (mpConfigurado) {
                    log.info("Seleccionando pasarela real Mercado Pago para YAPE_PLIN");
                    yield mercadoPagoGateway;
                } else if (mockGatewaysEnabled) {
                    log.info("Mercado Pago no configurado; seleccionando YapePlinGateway mock");
                    yield yapePlinMockGateway;
                } else {
                    throw new IllegalStateException(
                            "Pasarela Yape/Plin no configurada en este entorno");
                }
            }
        };
    }
}
