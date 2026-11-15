package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.CobroEfectivoRequest;
import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.EfectivoPendienteResponse;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.YapeOtpPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.gateway.ConsultaPagoMercadoPago;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.gateway.PaymentGatewayService;
import com.sistema.polleria.payments.repository.PagoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServiceUnavailable;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class PaymentsAuditHardeningTest {

    @Mock private PagoRepository pagoRepository;
    @Mock private PaymentGatewayService paymentGatewayService;
    @Mock private MercadoPagoGateway mercadoPagoGateway;
    @Mock private NotificadorOrden notificadorOrden;
    @Mock private WhatsappNotificationClient whatsappNotificationClient;
    @Mock private OrdenesClient ordenesClient;
    @Mock private AlmacenComprobantes almacenComprobantes;
    @Mock private ConsultaPagoMercadoPago consultaPagoMercadoPago;
    @Mock private FinanceComprobanteClient financeComprobanteClient;

    private PagoService pagoService;

    @BeforeEach
    void setUp() {
        pagoService = new PagoService(
                pagoRepository,
                paymentGatewayService,
                mercadoPagoGateway,
                notificadorOrden,
                whatsappNotificationClient,
                ordenesClient,
                almacenComprobantes,
                consultaPagoMercadoPago,
                financeComprobanteClient,
                null);
    }

    private static Pago pago(long id, long ordenId, MetodoPago metodo, EstadoPago estado, String monto) {
        Pago p = new Pago();
        p.setId(id);
        p.setOrdenId(ordenId);
        p.setClienteId(10L);
        p.setMonto(new BigDecimal(monto));
        p.setMetodoPago(metodo);
        p.setEstado(estado);
        return p;
    }

    @Test
    @DisplayName("SEC-02: Yape OTP simulado falla cuando payments.yape-otp-mock.enabled=false")
    void procesarYapeOtp_deshabilitado_rechaza() {
        ReflectionTestUtils.setField(pagoService, "yapeOtpMockEnabled", false);

        assertThatThrownBy(() -> pagoService.procesarYapeOtp(
                new YapeOtpPagoRequest(100L, new BigDecimal("35.00"), "999888777", "123456", null),
                10L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("deshabilitado");
        verify(ordenesClient, never()).obtener(any());
    }

    @Test
    @DisplayName("DIN-08: confirmar actualiza metodoPago cuando la pasarela informa YAPE_PLIN")
    void confirmar_actualizaMetodoPagoYMpPaymentId() {
        Pago p = pago(1L, 200L, MetodoPago.TARJETA, EstadoPago.PENDIENTE, "50.00");
        when(pagoRepository.buscarConBloqueo(1L)).thenReturn(Optional.of(p));
        when(ordenesClient.obtener(200L)).thenReturn(
                new OrdenesClient.OrdenInfo(200L, "PENDIENTE_PAGO", "DELIVERY", new BigDecimal("50.00"), 10L, LocalDateTime.now()));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.confirmar(
                1L,
                new ConfirmarPagoRequest("MP-777", "Aprobado Yape MP", MetodoPago.YAPE_PLIN, "777"),
                "");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(res.metodoPago()).isEqualTo(MetodoPago.YAPE_PLIN);
        assertThat(p.getMpPaymentId()).isEqualTo("777");
        verify(financeComprobanteClient).emitirBoletaDigitalAsync(any(Pago.class));
    }

    @Test
    @DisplayName("DIN-01/CON-04: confirmar pago MP sobre orden ya CANCELADO reembolsa automáticamente")
    void confirmar_ordenCancelada_reembolsaAutomaticamente() {
        Pago p = pago(2L, 201L, MetodoPago.TARJETA, EstadoPago.PENDIENTE, "60.00");
        when(pagoRepository.buscarConBloqueo(2L)).thenReturn(Optional.of(p));
        when(ordenesClient.obtener(201L)).thenReturn(
                new OrdenesClient.OrdenInfo(201L, "CANCELADO", "DELIVERY", new BigDecimal("60.00"), 10L, LocalDateTime.now()));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.confirmar(
                2L,
                new ConfirmarPagoRequest("MP-888", "Aprobado tardío", MetodoPago.TARJETA, "888"),
                "");

        assertThat(res.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(res.montoReembolsado()).isEqualByComparingTo("60.00");
        verify(mercadoPagoGateway).procesarReembolso(eq(p), eq(new BigDecimal("60.00")));
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("DIN-02: cancelar rechaza pagos PENDIENTE_VERIFICACION o APROBADO")
    void cancelar_estadosProtegidos_rechaza() {
        Pago enVerif = pago(3L, 202L, MetodoPago.YAPE_PLIN, EstadoPago.PENDIENTE_VERIFICACION, "40.00");
        when(pagoRepository.buscarConBloqueo(3L)).thenReturn(Optional.of(enVerif));
        assertThatThrownBy(() -> pagoService.cancelar(3L))
                .isInstanceOf(IllegalStateException.class);

        Pago aprobado = pago(4L, 203L, MetodoPago.TARJETA, EstadoPago.APROBADO, "40.00");
        when(pagoRepository.buscarConBloqueo(4L)).thenReturn(Optional.of(aprobado));
        assertThatThrownBy(() -> pagoService.cancelar(4L))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("CON-01/DIN-05: reembolsar aplica tope acumulado e idempotencia por Idempotency-Key")
    void reembolsar_topeAcumuladoEIdempotencia() {
        Pago p = pago(5L, 204L, MetodoPago.TARJETA, EstadoPago.APROBADO, "100.00");
        p.setMpPaymentId("999001");
        when(pagoRepository.buscarConBloqueo(5L)).thenReturn(Optional.of(p));
        when(pagoRepository.findByReembolsoIdempotencyKey("KEY-1")).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mercadoPagoGateway.esPagoMercadoPago(p)).thenReturn(true);

        PagoResponse primero = pagoService.reembolsar(5L, new BigDecimal("40.00"), "Parcial 1", "KEY-1");
        assertThat(primero.estado()).isEqualTo(EstadoPago.REEMBOLSADO_PARCIAL);
        assertThat(primero.montoReembolsado()).isEqualByComparingTo("40.00");

        // Misma Idempotency-Key devuelve idempotente sin volver a invocar MP.
        PagoResponse repetido = pagoService.reembolsar(5L, new BigDecimal("40.00"), "Reintento", "KEY-1");
        assertThat(repetido.montoReembolsado()).isEqualByComparingTo("40.00");
        verify(mercadoPagoGateway, org.mockito.Mockito.times(1)).procesarReembolso(any(), any());

        // Intento de reembolsar mas del saldo disponible (60.00) es rechazado.
        when(pagoRepository.findByReembolsoIdempotencyKey("KEY-EXCESO")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> pagoService.reembolsar(5L, new BigDecimal("70.00"), "Exceso", "KEY-EXCESO"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("supera el saldo disponible");

        // Completar el saldo restante lleva a REEMBOLSADO.
        when(pagoRepository.findByReembolsoIdempotencyKey("KEY-2")).thenReturn(Optional.empty());
        PagoResponse total = pagoService.reembolsar(5L, new BigDecimal("60.00"), "Saldo final", "KEY-2");
        assertThat(total.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(total.montoReembolsado()).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("DIN-06: webhook no degrada APROBADO a RECHAZADO/CANCELADO, sí permite REEMBOLSADO_PARCIAL")
    void actualizarEstadoDesdePasarela_protegeAprobado() {
        Pago p = pago(6L, 205L, MetodoPago.TARJETA, EstadoPago.APROBADO, "55.00");
        when(pagoRepository.buscarConBloqueo(6L)).thenReturn(Optional.of(p));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse sinCambio = pagoService.actualizarEstadoDesdePasarela(6L, EstadoPago.RECHAZADO, "tardío");
        assertThat(sinCambio.estado()).isEqualTo(EstadoPago.APROBADO);

        PagoResponse parcial = pagoService.actualizarEstadoDesdePasarela(6L, EstadoPago.REEMBOLSADO_PARCIAL, "parcial");
        assertThat(parcial.estado()).isEqualTo(EstadoPago.REEMBOLSADO_PARCIAL);
        verify(pagoRepository, org.mockito.Mockito.times(1)).save(any(Pago.class));
    }

    @Test
    @DisplayName("DIN-04: efectivoPendiente netea montoReembolsado y liquidarEfectivo admite REEMBOLSADO_PARCIAL")
    void efectivoPendiente_y_liquidar_manejanReembolsosParciales() {
        Pago parcial = pago(7L, 206L, MetodoPago.CONTRAENTREGA, EstadoPago.REEMBOLSADO_PARCIAL, "80.00");
        parcial.setMontoReembolsado(new BigDecimal("25.00"));
        parcial.setRepartidorId(12L);
        parcial.setVerificadoEn(LocalDateTime.now());
        when(pagoRepository.efectivoPendienteDeRepartidor(eq(12L), any())).thenReturn(List.of(parcial));

        EfectivoPendienteResponse pendiente = pagoService.efectivoPendiente(12L, LocalDateTime.now().minusHours(1));
        assertThat(pendiente.total()).isEqualByComparingTo("55.00");

        when(pagoRepository.findAllById(List.of(7L))).thenReturn(List.of(parcial));
        int marcados = pagoService.liquidarEfectivo(List.of(7L), 99L);
        assertThat(marcados).isEqualTo(1);
        assertThat(parcial.getLiquidacionId()).isEqualTo(99L);
    }

    @Test
    @DisplayName("DIN-14: repartidor distinto al asignado recibe AccessDeniedException al cobrar en efectivo")
    void procesarCobroEfectivo_repartidorNoAsignado_rechaza() {
        Pago pendiente = pago(8L, 207L, MetodoPago.CONTRAENTREGA, EstadoPago.PENDIENTE, "42.00");
        when(pagoRepository.buscarPorOrdenIdConBloqueo(207L)).thenReturn(Optional.of(pendiente));
        when(ordenesClient.obtener(207L)).thenReturn(
                new OrdenesClient.OrdenInfo(207L, "EN_PUERTA", "DELIVERY", new BigDecimal("42.00"), 10L,
                        LocalDateTime.now(), 77L, "Cliente"));

        assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(207L, new BigDecimal("42.00"), new BigDecimal("50.00"), new BigDecimal("8.00")),
                88L, 88L, "Bearer r"))
                .isInstanceOf(AccessDeniedException.class);
        verify(pagoRepository, never()).save(any());
    }

    @Test
    @DisplayName("DIN-11: MercadoPagoGateway solo reconoce IDs verificados de MP y excluye CONTRAENTREGA/referencia numérica libre")
    void mercadoPagoGateway_esPagoMercadoPago_filtraEstricto() {
        MercadoPagoGateway gateway = new MercadoPagoGateway(pagoRepository);

        Pago soloNumeroLibre = pago(9L, 208L, MetodoPago.TARJETA, EstadoPago.APROBADO, "30.00");
        soloNumeroLibre.setReferenciaExterna("12345678");
        assertThat(gateway.esPagoMercadoPago(soloNumeroLibre)).isFalse();

        Pago contraentrega = pago(10L, 209L, MetodoPago.CONTRAENTREGA, EstadoPago.APROBADO, "30.00");
        contraentrega.setMpPaymentId("12345678");
        assertThat(gateway.esPagoMercadoPago(contraentrega)).isFalse();

        Pago verificado = pago(11L, 210L, MetodoPago.TARJETA, EstadoPago.APROBADO, "30.00");
        verificado.setMpPaymentId("987654321");
        assertThat(gateway.esPagoMercadoPago(verificado)).isTrue();
    }

    @Test
    @DisplayName("DIN-01: NotificadorOrden reintenta fallos 5xx (hasta 3 intentos) pero no 4xx")
    void notificadorOrden_reintentaSoloErroresTransitorios() {
        RestClient.Builder builder5xx = RestClient.builder().baseUrl("http://orders.test");
        MockRestServiceServer server5xx = MockRestServiceServer.bindTo(builder5xx).build();
        server5xx.expect(times(2), requestTo("http://orders.test/ordenes/1/estado"))
                .andExpect(method(HttpMethod.PATCH))
                .andRespond(withServiceUnavailable());
        server5xx.expect(times(1), requestTo("http://orders.test/ordenes/1/estado"))
                .andExpect(method(HttpMethod.PATCH))
                .andRespond(withSuccess());

        NotificadorOrden notificador = new NotificadorOrden(builder5xx.build());
        notificador.notificarEstado(1L, "RECIBIDO", "");
        server5xx.verify();

        RestClient.Builder builder4xx = RestClient.builder().baseUrl("http://orders.test");
        MockRestServiceServer server4xx = MockRestServiceServer.bindTo(builder4xx).build();
        server4xx.expect(times(1), requestTo("http://orders.test/ordenes/2/estado"))
                .andExpect(method(HttpMethod.PATCH))
                .andRespond(withBadRequest());

        new NotificadorOrden(builder4xx.build()).notificarEstado(2L, "RECIBIDO", "");
        server4xx.verify();
    }
}
