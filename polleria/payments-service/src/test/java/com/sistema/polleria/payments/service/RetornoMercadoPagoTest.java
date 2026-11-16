package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.gateway.ConsultaPagoMercadoPago;
import com.sistema.polleria.payments.gateway.ConsultaPagoMercadoPago.PagoMercadoPago;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.gateway.PaymentGatewayService;
import com.sistema.polleria.payments.repository.PagoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * The public return URL of Mercado Pago only hints the result: a payment is approved only when
 * Mercado Pago itself reports it approved, for this payment and for its amount.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RetornoMercadoPagoTest {

    @Mock private PagoRepository pagoRepository;
    @Mock private PaymentGatewayService paymentGatewayService;
    @Mock private MercadoPagoGateway mercadoPagoGateway;
    @Mock private NotificadorOrden notificadorOrden;
    @Mock private WhatsappNotificationClient whatsappNotificationClient;
    @Mock private OrdenesClient ordenesClient;
    @Mock private AlmacenComprobantes almacenComprobantes;
    @Mock private ConsultaPagoMercadoPago consultaPagoMercadoPago;

    private PagoService service;
    private Pago pago;

    @BeforeEach
    void setUp() {
        service = spy(new PagoService(pagoRepository, paymentGatewayService, mercadoPagoGateway, notificadorOrden,
                whatsappNotificationClient, ordenesClient, almacenComprobantes, consultaPagoMercadoPago));
        pago = new Pago();
        pago.setId(13L);
        pago.setOrdenId(130L);
        pago.setMonto(new BigDecimal("45.00"));
        pago.setMetodoPago(MetodoPago.TARJETA);
        pago.setEstado(EstadoPago.PENDIENTE);
        when(pagoRepository.findById(13L)).thenReturn(Optional.of(pago));
        doReturn(PagoResponse.from(pago)).when(service).confirmar(anyLong(), any(), anyString());
        doReturn(null).when(service).actualizarEstadoDesdePasarela(anyLong(), any(), anyString());
    }

    private void mercadoPagoDice(String estado, String referencia, String monto) {
        when(consultaPagoMercadoPago.consultar(555L))
                .thenReturn(Optional.of(new PagoMercadoPago(estado, referencia, new BigDecimal(monto))));
    }

    @Test
    @DisplayName("Una URL con status=approved no aprueba si Mercado Pago dice que el pago está pendiente")
    void urlFalsificadaNoApruebaElPago() {
        mercadoPagoDice("pending", "13", "45.00");

        service.procesarRetornoMercadoPago("555", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("Sin payment_id no hay nada que verificar: no aprueba")
    void sinPaymentIdNoAprueba() {
        service.procesarRetornoMercadoPago(null, "approved", "13");
        service.procesarRetornoMercadoPago("abc", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
        verifyNoInteractions(consultaPagoMercadoPago);
    }

    @Test
    @DisplayName("Un pago aprobado de otra referencia no aprueba este pago")
    void pagoAprobadoDeOtraReferenciaNoAprueba() {
        mercadoPagoDice("approved", "99", "45.00");

        service.procesarRetornoMercadoPago("555", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("Un pago aprobado por otro monto no aprueba este pago")
    void pagoAprobadoPorOtroMontoNoAprueba() {
        mercadoPagoDice("approved", "13", "1.00");

        service.procesarRetornoMercadoPago("555", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("Si Mercado Pago no responde, no aprueba")
    void mercadoPagoNoDisponibleNoAprueba() {
        when(consultaPagoMercadoPago.consultar(555L)).thenReturn(Optional.empty());

        service.procesarRetornoMercadoPago("555", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("Aprobado por Mercado Pago para esta referencia y monto: confirma con la referencia MP")
    void aprobadoVerificadoConfirma() {
        mercadoPagoDice("approved", "13", "45.00");

        service.procesarRetornoMercadoPago("555", "pending", "13");

        ArgumentCaptor<ConfirmarPagoRequest> req = ArgumentCaptor.forClass(ConfirmarPagoRequest.class);
        verify(service).confirmar(eq(13L), req.capture(), eq(""));
        assertThat(req.getValue().referenciaExterna()).isEqualTo("MP-555");
    }

    @Test
    @DisplayName("Rechazado según Mercado Pago marca RECHAZADO aunque la URL diga approved")
    void rechazadoVerificadoMarcaRechazado() {
        mercadoPagoDice("rejected", "13", "45.00");

        service.procesarRetornoMercadoPago("555", "approved", "13");

        verify(service, never()).confirmar(anyLong(), any(), anyString());
        verify(service).actualizarEstadoDesdePasarela(eq(13L), eq(EstadoPago.RECHAZADO), anyString());
    }
}
