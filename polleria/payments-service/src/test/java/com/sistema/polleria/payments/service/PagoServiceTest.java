package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.CobroEfectivoRequest;
import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.PreferenceResponse;
import com.sistema.polleria.payments.dto.RegistrarComprobanteRequest;
import com.sistema.polleria.payments.dto.VerificarPagoRequest;
import com.sistema.polleria.payments.dto.YapeOtpPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.gateway.GatewayResult;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.gateway.PaymentGateway;
import com.sistema.polleria.payments.gateway.PaymentGatewayService;
import com.sistema.polleria.payments.repository.PagoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PagoServiceTest {

    @Mock
    private PagoRepository pagoRepository;

    @Mock
    private PaymentGatewayService paymentGatewayService;

    @Mock
    private MercadoPagoGateway mercadoPagoGateway;

    @Mock
    private NotificadorOrden notificadorOrden;

    @Mock
    private WhatsappNotificationClient whatsappNotificationClient;

    @Mock
    private OrdenesClient ordenesClient;

    @Mock
    private AlmacenComprobantes almacenComprobantes;

    @InjectMocks
    private PagoService pagoService;

    private static OrdenesClient.OrdenInfo orden(long id, String tipo, String estado, String total) {
        return new OrdenesClient.OrdenInfo(id, estado, tipo, new BigDecimal(total), 10L, LocalDateTime.now());
    }

    @Test
    @DisplayName("Debe iniciar un pago exitosamente usando el gateway seleccionado")
    void iniciar_exitoso() {
        IniciarPagoRequest request = new IniciarPagoRequest(10L, new BigDecimal("45.00"), MetodoPago.TARJETA, null, null);
        PaymentGateway mockGateway = mock(PaymentGateway.class);
        GatewayResult result = new GatewayResult(EstadoPago.PENDIENTE, "PREF-123", "Checkout Pro MP", "https://mp.com/checkout");

        when(pagoRepository.findByOrdenId(10L)).thenReturn(Optional.empty());
        when(paymentGatewayService.seleccionar(MetodoPago.TARJETA)).thenReturn(mockGateway);
        when(mockGateway.procesar(request, 1L)).thenReturn(result);
        when(pagoRepository.saveAndFlush(any(Pago.class))).thenAnswer(inv -> {
            Pago p = inv.getArgument(0);
            p.setId(100L);
            return p;
        });

        PagoResponse response = pagoService.iniciar(request, 1L, "Bearer test");

        assertThat(response.id()).isEqualTo(100L);
        assertThat(response.estado()).isEqualTo(EstadoPago.PENDIENTE);
        assertThat(response.referenciaExterna()).isEqualTo("PREF-123");
        assertThat(response.checkoutUrl()).isEqualTo("https://mp.com/checkout");
        verify(pagoRepository).saveAndFlush(any(Pago.class));
    }

    @Test
    @DisplayName("Debe confirmar un pago y cambiar estado a APROBADO")
    void confirmar_exitoso() {
        Pago pago = new Pago();
        pago.setId(5L);
        pago.setOrdenId(50L);
        pago.setEstado(EstadoPago.PENDIENTE);

        when(pagoRepository.buscarConBloqueo(5L)).thenReturn(Optional.of(pago));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        ConfirmarPagoRequest req = new ConfirmarPagoRequest("MP-12345", "Pago aprobado");
        PagoResponse res = pagoService.confirmar(5L, req, "");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(res.referenciaExterna()).isEqualTo("MP-12345");
        verify(pagoRepository).save(pago);
    }

    @Test
    @DisplayName("Debe procesar el reembolso de un pago previamente aprobado llamando a Mercado Pago si aplica")
    void reembolsar_exitoso() {
        Pago pagoAprobado = new Pago();
        pagoAprobado.setId(1L);
        pagoAprobado.setOrdenId(100L);
        pagoAprobado.setClienteId(7L);
        pagoAprobado.setMonto(new BigDecimal("85.50"));
        pagoAprobado.setMetodoPago(MetodoPago.TARJETA);
        pagoAprobado.setEstado(EstadoPago.APROBADO);
        pagoAprobado.setReferenciaExterna("MP-987654321");
        pagoAprobado.setCreadoEn(LocalDateTime.now());

        when(pagoRepository.findById(1L)).thenReturn(Optional.of(pagoAprobado));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mercadoPagoGateway.esPagoMercadoPago(pagoAprobado)).thenReturn(true);

        PagoResponse res = pagoService.reembolsar(1L, new BigDecimal("85.50"), "Pedido llegó frío y cliente canceló");

        assertThat(res.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(pagoAprobado.getEstado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(pagoAprobado.getDetalle()).contains("Reembolso procesado por S/ 85.50");
        verify(mercadoPagoGateway).procesarReembolso(pagoAprobado, new BigDecimal("85.50"));
        verify(pagoRepository).save(pagoAprobado);
    }

    @Test
    @DisplayName("Debe fallar al reembolsar si el pago no se encuentra en estado APROBADO")
    void reembolsar_fallaSiEstadoInvalido() {
        Pago pagoPendiente = new Pago();
        pagoPendiente.setId(2L);
        pagoPendiente.setOrdenId(101L);
        pagoPendiente.setClienteId(8L);
        pagoPendiente.setMonto(new BigDecimal("45.00"));
        pagoPendiente.setMetodoPago(MetodoPago.YAPE_PLIN);
        pagoPendiente.setEstado(EstadoPago.PENDIENTE);

        when(pagoRepository.findById(2L)).thenReturn(Optional.of(pagoPendiente));

        assertThatThrownBy(() -> pagoService.reembolsar(2L, new BigDecimal("45.00"), "Error"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Solo se pueden reembolsar pagos que hayan sido APROBADOS");

        verify(pagoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe reembolsar buscando el pago por su ordenId")
    void reembolsarPorOrden_exitoso() {
        Pago pago = new Pago();
        pago.setId(3L);
        pago.setOrdenId(250L);
        pago.setClienteId(9L);
        pago.setMonto(new BigDecimal("60.00"));
        pago.setMetodoPago(MetodoPago.CONTRAENTREGA);
        pago.setEstado(EstadoPago.APROBADO);

        when(pagoRepository.findByOrdenId(250L)).thenReturn(Optional.of(pago));
        when(pagoRepository.findById(3L)).thenReturn(Optional.of(pago));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.reembolsarPorOrden(250L, new BigDecimal("60.00"), "Error en entrega");

        assertThat(res.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        verify(pagoRepository).findByOrdenId(250L);
        verify(pagoRepository).save(pago);
    }

    @Test
    @DisplayName("Al confirmar un pago se encola el WhatsApp de pago confirmado (RF30)")
    void confirmar_notificaPorWhatsapp() {
        Pago pago = new Pago();
        pago.setId(3L);
        pago.setOrdenId(52L);
        pago.setMonto(new BigDecimal("68.50"));
        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pago.setEstado(EstadoPago.PENDIENTE);
        pago.setCreadoEn(LocalDateTime.now());

        when(pagoRepository.buscarConBloqueo(3L)).thenReturn(Optional.of(pago));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        pagoService.confirmar(3L, new ConfirmarPagoRequest("YP-123", "Yape recibido"), "Bearer x");

        verify(whatsappNotificationClient).notificarPagoConfirmado(52L, new BigDecimal("68.50"), MetodoPago.YAPE_PLIN);
    }

    @Test
    @DisplayName("Confirmar un pago ya aprobado es idempotente: no vuelve a notificar (webhooks reintentados)")
    void confirmar_deUnPagoYaAprobadoNoVuelveANotificar() {
        Pago pago = new Pago();
        pago.setId(9L);
        pago.setOrdenId(90L);
        pago.setMonto(new BigDecimal("34.00"));
        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pago.setEstado(EstadoPago.APROBADO);

        when(pagoRepository.buscarConBloqueo(9L)).thenReturn(Optional.of(pago));

        PagoResponse res = pagoService.confirmar(9L, new ConfirmarPagoRequest("MP-DUP", "reintento"), "");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(whatsappNotificationClient, never())
                .notificarPagoConfirmado(any(), any(), any());
    }

    @Test
    @DisplayName("Un webhook 'in_process' tardío no degrada a PENDIENTE un pago ya APROBADO")
    void actualizarEstadoDesdePasarela_noDegradaUnPagoAprobado() {
        Pago pago = new Pago();
        pago.setId(12L);
        pago.setOrdenId(120L);
        pago.setEstado(EstadoPago.APROBADO);

        when(pagoRepository.buscarConBloqueo(12L)).thenReturn(Optional.of(pago));

        PagoResponse res = pagoService.actualizarEstadoDesdePasarela(
                12L, EstadoPago.PENDIENTE, "Pago en proceso en Mercado Pago (in_process)");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.APROBADO);
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    @Test
    @DisplayName("Un webhook de rechazo sí cambia el estado y toma el bloqueo del pago")
    void actualizarEstadoDesdePasarela_aplicaElRechazo() {
        Pago pago = new Pago();
        pago.setId(13L);
        pago.setOrdenId(130L);
        pago.setEstado(EstadoPago.PENDIENTE);

        when(pagoRepository.buscarConBloqueo(13L)).thenReturn(Optional.of(pago));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.actualizarEstadoDesdePasarela(
                13L, EstadoPago.RECHAZADO, "Pago rechazado por Mercado Pago");

        assertThat(res.estado()).isEqualTo(EstadoPago.RECHAZADO);
        verify(pagoRepository).buscarConBloqueo(13L);
        verify(pagoRepository).save(pago);
    }

    @Test
    @DisplayName("Pago con Yape OTP válido aprueba de inmediato y avanza a cocina")
    void procesarYapeOtp_conOtpValido_aprueba() {
        when(ordenesClient.obtener(301L)).thenReturn(orden(301L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(301L)).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> {
            Pago p = inv.getArgument(0);
            p.setId(99L);
            return p;
        });

        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                301L, new BigDecimal("45.00"), "987654321", "123456", "cliente@test.com");

        PagoResponse res = pagoService.procesarYapeOtp(req, 10L, "Bearer token");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(res.referenciaExterna()).startsWith("MP-YAPE-");
        verify(notificadorOrden).notificarPagoAprobado(eq(301L), eq("Bearer token"));
    }

    @Test
    @DisplayName("Pago con Yape OTP inválido '000000' es rechazado")
    void procesarYapeOtp_conOtpInvalido_rechaza() {
        when(ordenesClient.obtener(302L)).thenReturn(orden(302L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(302L)).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        YapeOtpPagoRequest req = new YapeOtpPagoRequest(
                302L, new BigDecimal("45.00"), "987654321", "000000", "cliente@test.com");

        PagoResponse res = pagoService.procesarYapeOtp(req, 10L, "Bearer token");

        assertThat(res.estado()).isEqualTo(EstadoPago.RECHAZADO);
        assertThat(res.detalle()).contains("inválido");
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("S6: el cobro en efectivo de un repartidor guarda su repartidor_id")
    void procesarCobroEfectivo_guardaRepartidor() {
        when(ordenesClient.obtener(310L)).thenReturn(orden(310L, "DELIVERY", "EN_PUERTA", "70.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(310L)).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(310L, new BigDecimal("70.00"), null, null), 4L, 4L, "Bearer r");

        org.mockito.ArgumentCaptor<Pago> captor = org.mockito.ArgumentCaptor.forClass(Pago.class);
        verify(pagoRepository).save(captor.capture());
        assertThat(captor.getValue().getRepartidorId()).isEqualTo(4L);
        assertThat(captor.getValue().getLiquidacionId()).isNull();
    }

    @Test
    @DisplayName("S6: el cobro en efectivo del cajero no deja repartidor_id")
    void procesarCobroEfectivo_cajeroSinRepartidor() {
        when(ordenesClient.obtener(311L)).thenReturn(orden(311L, "RECOJO", "LISTO", "30.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(311L)).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(311L, new BigDecimal("30.00"), null, null, "POL-311"), 2L, "Bearer c");

        org.mockito.ArgumentCaptor<Pago> captor = org.mockito.ArgumentCaptor.forClass(Pago.class);
        verify(pagoRepository).save(captor.capture());
        assertThat(captor.getValue().getRepartidorId()).isNull();
    }

    private static Pago efectivo(long id, long ordenId, String monto, Long liquidacionId) {
        Pago p = new Pago();
        p.setId(id);
        p.setOrdenId(ordenId);
        p.setMonto(new BigDecimal(monto));
        p.setMetodoPago(MetodoPago.CONTRAENTREGA);
        p.setEstado(EstadoPago.APROBADO);
        p.setRepartidorId(4L);
        p.setLiquidacionId(liquidacionId);
        p.setVerificadoEn(LocalDateTime.of(2026, 1, 1, 12, 0));
        return p;
    }

    @Test
    @DisplayName("S6: efectivoPendiente suma los cobros del repartidor sin liquidar")
    void efectivoPendiente_sumaYListaLosPagos() {
        LocalDateTime desde = LocalDateTime.of(2026, 1, 1, 9, 0);
        when(pagoRepository.efectivoPendienteDeRepartidor(4L, desde))
                .thenReturn(java.util.List.of(efectivo(1L, 100L, "70.00", null), efectivo(2L, 101L, "30.50", null)));

        var res = pagoService.efectivoPendiente(4L, desde);

        assertThat(res.repartidorId()).isEqualTo(4L);
        assertThat(res.total()).isEqualByComparingTo("100.50");
        assertThat(res.cantidad()).isEqualTo(2);
        assertThat(res.pagos()).extracting("pagoId").containsExactly(1L, 2L);
    }

    @Test
    @DisplayName("S6: liquidarEfectivo marca los pagos y es idempotente para la misma liquidacion")
    void liquidarEfectivo_marcaEIdempotente() {
        Pago libre = efectivo(1L, 100L, "70.00", null);
        Pago yaSuya = efectivo(2L, 101L, "30.00", 9L);
        when(pagoRepository.findAllById(java.util.List.of(1L, 2L))).thenReturn(java.util.List.of(libre, yaSuya));

        int n = pagoService.liquidarEfectivo(java.util.List.of(1L, 2L), 9L);

        assertThat(n).isEqualTo(2);
        assertThat(libre.getLiquidacionId()).isEqualTo(9L);
        assertThat(yaSuya.getLiquidacionId()).isEqualTo(9L);
        verify(pagoRepository).saveAll(any());
    }

    @Test
    @DisplayName("S6: liquidarEfectivo rechaza un pago ya liquidado por otra liquidacion y no cambia nada")
    void liquidarEfectivo_rechazaPagoDeOtraLiquidacion() {
        Pago libre = efectivo(1L, 100L, "70.00", null);
        Pago ajeno = efectivo(2L, 101L, "30.00", 5L);
        when(pagoRepository.findAllById(java.util.List.of(1L, 2L))).thenReturn(java.util.List.of(libre, ajeno));

        assertThatThrownBy(() -> pagoService.liquidarEfectivo(java.util.List.of(1L, 2L), 9L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("#5");

        assertThat(libre.getLiquidacionId()).isNull();
        verify(pagoRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("S6: liquidarEfectivo rechaza pagos que no son efectivo aprobado o no existen")
    void liquidarEfectivo_rechazaNoEfectivoOInexistente() {
        Pago tarjeta = efectivo(1L, 100L, "70.00", null);
        tarjeta.setMetodoPago(MetodoPago.TARJETA);
        when(pagoRepository.findAllById(java.util.List.of(1L))).thenReturn(java.util.List.of(tarjeta));
        assertThatThrownBy(() -> pagoService.liquidarEfectivo(java.util.List.of(1L), 9L))
                .isInstanceOf(IllegalStateException.class);

        when(pagoRepository.findAllById(java.util.List.of(7L))).thenReturn(java.util.List.of());
        assertThatThrownBy(() -> pagoService.liquidarEfectivo(java.util.List.of(7L), 9L))
                .isInstanceOf(java.util.NoSuchElementException.class);
    }

    @Test
    @DisplayName("Cobro en efectivo registra pago contraentrega y avanza orden a ENTREGADO")
    void procesarCobroEfectivo_registraYCompletaEntrega() {
        when(ordenesClient.obtener(303L)).thenReturn(orden(303L, "DELIVERY", "EN_PUERTA", "70.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(303L)).thenReturn(Optional.empty());
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> {
            Pago p = inv.getArgument(0);
            p.setId(101L);
            return p;
        });

        CobroEfectivoRequest req = new CobroEfectivoRequest(
                303L, new BigDecimal("70.00"), new BigDecimal("100.00"), new BigDecimal("30.00"));

        PagoResponse res = pagoService.procesarCobroEfectivo(req, 4L, "Bearer motorizado");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        assertThat(res.metodoPago()).isEqualTo(MetodoPago.CONTRAENTREGA);
        verify(notificadorOrden).notificarEstado(eq(303L), eq("ENTREGADO"), eq("Bearer motorizado"));
    }

    @Test
    @DisplayName("S6: el cobro en efectivo se rechaza si la orden no esta en un estado de entrega valido")
    void procesarCobroEfectivo_estadoInvalido_rechaza() {
        for (String[] caso : new String[][] {
                {"DELIVERY", "PREPARANDO"}, {"DELIVERY", "ENTREGADO"}, {"RECOJO", "PREPARANDO"},
                {"RECOJO", "EN_PUERTA"}, {"SALON", "LISTO"}}) {
            when(pagoRepository.buscarPorOrdenIdConBloqueo(304L)).thenReturn(Optional.empty());
            when(ordenesClient.obtener(304L)).thenReturn(orden(304L, caso[0], caso[1], "70.00"));
            CobroEfectivoRequest req = new CobroEfectivoRequest(304L, new BigDecimal("70.00"), null, null);

            assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(req, 4L, "Bearer t"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("No se puede cobrar en efectivo");
        }
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
    }

    @Test
    @DisplayName("S6: el cobro en efectivo se permite en EN_CAMINO/EN_PUERTA (delivery) y LISTO/LISTO_PARA_ENTREGAR (recojo)")
    void procesarCobroEfectivo_estadosValidos_permiten() {
        for (String[] caso : new String[][] {
                {"DELIVERY", "EN_CAMINO"}, {"DELIVERY", "EN_PUERTA"}, {"RECOJO", "LISTO"},
                {"RECOJO", "LISTO_PARA_ENTREGAR"}}) {
            when(pagoRepository.buscarPorOrdenIdConBloqueo(305L)).thenReturn(Optional.empty());
            when(ordenesClient.obtener(305L)).thenReturn(orden(305L, caso[0], caso[1], "70.00"));
            when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

            PagoResponse res = pagoService.procesarCobroEfectivo(
                    new CobroEfectivoRequest(305L, new BigDecimal("70.00"), null, null, "POL-305"), 4L, "Bearer t");

            assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        }
    }

    @Test
    @DisplayName("S6: si orders-service no responde, el cobro en efectivo falla cerrado")
    void procesarCobroEfectivo_ordersCaido_fallaCerrado() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(306L)).thenReturn(Optional.empty());
        when(ordenesClient.obtener(306L)).thenThrow(new OrdenesClient.OrdenNoDisponibleException("caido", null));

        assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(306L, new BigDecimal("70.00"), null, null), 4L, "Bearer t"))
                .isInstanceOf(OrdenesClient.OrdenNoDisponibleException.class);
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
    }

    @Test
    @DisplayName("S5: Yape OTP con monto distinto al total del pedido lanza IllegalArgumentException")
    void procesarYapeOtp_montoDistinto_rechaza() {
        when(ordenesClient.obtener(307L)).thenReturn(orden(307L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));

        assertThatThrownBy(() -> pagoService.procesarYapeOtp(
                new YapeOtpPagoRequest(307L, new BigDecimal("0.10"), "987654321", "123456", null), 10L, "Bearer t"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no coincide");
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    // ─── flow-edge-cases T2 ─────────────────────────────────────────

    private static Pago capturaPendiente(long id, long ordenId) {
        Pago p = new Pago();
        p.setId(id);
        p.setOrdenId(ordenId);
        p.setMonto(new BigDecimal("45.00"));
        p.setMetodoPago(MetodoPago.YAPE_PLIN);
        p.setEstado(EstadoPago.PENDIENTE_VERIFICACION);
        p.setComprobanteClave("comprobantes/yape/" + ordenId + ".jpg");
        return p;
    }

    @Test
    @DisplayName("S2: aprobar una captura de una orden que ya no esta PENDIENTE_PAGO responde 409 y no avanza")
    void verificar_ordenNoPendienteDePago_rechaza() {
        when(pagoRepository.buscarConBloqueo(501L)).thenReturn(Optional.of(capturaPendiente(501L, 401L)));
        when(ordenesClient.obtener(401L)).thenReturn(orden(401L, "DELIVERY", "CANCELADO", "45.00"));

        assertThatThrownBy(() -> pagoService.verificar(
                501L, new VerificarPagoRequest(true, null), "a@b", "Bearer t"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ya no está pendiente de pago");
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("S2: si orders-service no responde, aprobar la captura falla cerrado")
    void verificar_ordersCaido_fallaCerrado() {
        when(pagoRepository.buscarConBloqueo(502L)).thenReturn(Optional.of(capturaPendiente(502L, 402L)));
        when(ordenesClient.obtener(402L)).thenThrow(new OrdenesClient.OrdenNoDisponibleException("caido", null));

        assertThatThrownBy(() -> pagoService.verificar(
                502L, new VerificarPagoRequest(true, null), "a@b", "Bearer t"))
                .isInstanceOf(OrdenesClient.OrdenNoDisponibleException.class);
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("PRESERVE S2: aprobar una captura de una orden PENDIENTE_PAGO sigue funcionando")
    void verificar_ordenPendienteDePago_aprueba() {
        when(pagoRepository.buscarConBloqueo(503L)).thenReturn(Optional.of(capturaPendiente(503L, 403L)));
        when(ordenesClient.obtener(403L)).thenReturn(orden(403L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.verificar(503L, new VerificarPagoRequest(true, null), "a@b", "Bearer t");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(notificadorOrden).notificarPagoAprobado(eq(403L), eq("Bearer t"));
    }

    @Test
    @DisplayName("PRESERVE S2: rechazar una captura no consulta el estado de la orden")
    void verificar_rechazoSigueFuncionando() {
        when(pagoRepository.buscarConBloqueo(504L)).thenReturn(Optional.of(capturaPendiente(504L, 404L)));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.verificar(
                504L, new VerificarPagoRequest(false, "Captura ilegible"), "a@b", "Bearer t");

        assertThat(res.estado()).isEqualTo(EstadoPago.RECHAZADO);
        verify(ordenesClient, never()).obtener(any());
    }

    @Test
    @DisplayName("S3: registrar una captura por WhatsApp de una orden cerrada responde 409 y no guarda nada")
    void registrarComprobante_ordenCerrada_rechaza() {
        for (String estado : new String[] {"CANCELADO", "ENTREGADO", "PEDIDO_FANTASMA"}) {
            when(ordenesClient.obtener(405L)).thenReturn(orden(405L, "DELIVERY", estado, "45.00"));

            assertThatThrownBy(() -> pagoService.registrarComprobante(new RegistrarComprobanteRequest(
                    405L, "999888777", new BigDecimal("45.00"), "comprobantes/yape/405.jpg")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ya no está activo");
        }
        verify(pagoRepository, never()).saveAndFlush(any(Pago.class));
    }

    @Test
    @DisplayName("PRESERVE S3: registrar una captura por WhatsApp de una orden activa sigue funcionando")
    void registrarComprobante_ordenActiva_registra() {
        when(ordenesClient.obtener(406L)).thenReturn(orden(406L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.findByOrdenId(406L)).thenReturn(Optional.empty());
        when(pagoRepository.saveAndFlush(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.registrarComprobante(new RegistrarComprobanteRequest(
                406L, "999888777", new BigDecimal("45.00"), "comprobantes/yape/406.jpg"));

        assertThat(res.estado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
    }

    @Test
    @DisplayName("S6: el monto cobrado distinto al total del pedido responde 400 con el total y no registra")
    void procesarCobroEfectivo_montoDistintoAlTotal_rechaza() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(407L)).thenReturn(Optional.empty());
        when(ordenesClient.obtener(407L)).thenReturn(orden(407L, "DELIVERY", "EN_PUERTA", "24"));

        assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(407L, new BigDecimal("20.00"), null, null), 4L, "Bearer t"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("El monto cobrado debe ser el total del pedido (S/ 24.00)");
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
    }

    @Test
    @DisplayName("S6: el monto recibido menor al total del pedido responde 400 con el total y no registra")
    void procesarCobroEfectivo_montoRecibidoMenorAlTotal_rechaza() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(408L)).thenReturn(Optional.empty());
        when(ordenesClient.obtener(408L)).thenReturn(orden(408L, "DELIVERY", "EN_PUERTA", "24.00"));

        assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(408L, new BigDecimal("24.00"), new BigDecimal("20.00"), null),
                4L, "Bearer t"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("S/ 24.00");
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
    }

    @Test
    @DisplayName("S7: un cobro de RECOJO sin ticket o con un ticket incorrecto responde 400 y no registra")
    void procesarCobroEfectivo_recojoTicketInvalido_rechaza() {
        for (String ticket : new String[] {null, "", "POL-999", "51987654321"}) {
            when(pagoRepository.buscarPorOrdenIdConBloqueo(409L)).thenReturn(Optional.empty());
            when(ordenesClient.obtener(409L)).thenReturn(orden(409L, "RECOJO", "LISTO", "30.00"));

            assertThatThrownBy(() -> pagoService.procesarCobroEfectivo(
                    new CobroEfectivoRequest(409L, new BigDecimal("30.00"), null, null, ticket), 2L, "Bearer c"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("ticket");
        }
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any(), any());
    }

    @Test
    @DisplayName("S7: un cobro de RECOJO con el ticket correcto (sin distinguir mayusculas, espacios ni guiones) registra y lo reenvia")
    void procesarCobroEfectivo_recojoTicketValido_registraYReenvia() {
        for (String ticket : new String[] {"POL-410", "pol 410", " Pol410 "}) {
            when(pagoRepository.buscarPorOrdenIdConBloqueo(410L)).thenReturn(Optional.empty());
            when(ordenesClient.obtener(410L)).thenReturn(orden(410L, "RECOJO", "LISTO", "30.00"));
            when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

            PagoResponse res = pagoService.procesarCobroEfectivo(
                    new CobroEfectivoRequest(410L, new BigDecimal("30.00"), new BigDecimal("50"), null, ticket),
                    2L, "Bearer c");

            assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
            verify(notificadorOrden).notificarEstado(eq(410L), eq("ENTREGADO"), eq(ticket), eq("Bearer c"));
        }
    }

    @Test
    @DisplayName("PRESERVE S7: un cobro de DELIVERY sin ticket sigue funcionando y no reenvia ticket")
    void procesarCobroEfectivo_deliverySinTicket_sigueFuncionando() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(411L)).thenReturn(Optional.empty());
        when(ordenesClient.obtener(411L)).thenReturn(orden(411L, "DELIVERY", "EN_CAMINO", "24.00"));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(411L, new BigDecimal("24"), new BigDecimal("24.00"), null), 4L, "Bearer t");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(notificadorOrden).notificarEstado(eq(411L), eq("ENTREGADO"), eq("Bearer t"));
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any(), any());
    }

    // ─── flujo-pedido-web-whatsapp-e2e T3 ─────────────────────────────

    private static Pago pagoAprobado(long ordenId, MetodoPago metodo) {
        Pago p = new Pago();
        p.setId(900L + ordenId);
        p.setOrdenId(ordenId);
        p.setMonto(new BigDecimal("45.00"));
        p.setMetodoPago(metodo);
        p.setEstado(EstadoPago.APROBADO);
        return p;
    }

    private static IniciarPagoRequest preferencia(long ordenId, String monto) {
        return new IniciarPagoRequest(ordenId, new BigDecimal(monto), MetodoPago.TARJETA, null, null);
    }

    @Test
    @DisplayName("T3: Yape OTP de una orden que no espera pago (terminal o ContraPago) responde 409 y no cobra")
    void procesarYapeOtp_ordenNoPendienteDePago_rechaza() {
        for (String estado : new String[] {"CANCELADO", "ENTREGADO", "PEDIDO_FANTASMA", "PENDIENTE_CONFIRMACION"}) {
            when(ordenesClient.obtener(601L)).thenReturn(orden(601L, "DELIVERY", estado, "45.00"));
            when(pagoRepository.buscarPorOrdenIdConBloqueo(601L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> pagoService.procesarYapeOtp(
                    new YapeOtpPagoRequest(601L, new BigDecimal("45.00"), "987654321", "123456", null), 10L, "Bearer t"))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ya no está pendiente de pago");
        }
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("T3: Yape OTP falla cerrado si orders-service devuelve una orden vacía")
    void procesarYapeOtp_ordenNula_fallaCerrado() {
        when(ordenesClient.obtener(602L)).thenReturn(null);

        assertThatThrownBy(() -> pagoService.procesarYapeOtp(
                new YapeOtpPagoRequest(602L, new BigDecimal("45.00"), "987654321", "123456", null), 10L, "Bearer t"))
                .isInstanceOf(OrdenesClient.OrdenNoDisponibleException.class);
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    @Test
    @DisplayName("PRESERVE T3: reintentar un Yape OTP ya aprobado sigue siendo idempotente aunque la orden avanzó")
    void procesarYapeOtp_yaAprobado_esIdempotente() {
        when(ordenesClient.obtener(603L)).thenReturn(orden(603L, "DELIVERY", "EN_PREPARACION", "45.00"));
        when(pagoRepository.buscarPorOrdenIdConBloqueo(603L))
                .thenReturn(Optional.of(pagoAprobado(603L, MetodoPago.YAPE_PLIN)));

        PagoResponse res = pagoService.procesarYapeOtp(
                new YapeOtpPagoRequest(603L, new BigDecimal("45.00"), "987654321", "123456", null), 10L, "Bearer t");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(pagoRepository, never()).save(any(Pago.class));
        verify(notificadorOrden, never()).notificarPagoAprobado(any(), any());
    }

    @Test
    @DisplayName("T3: preferencia MP de invitado usa el total de la orden y el cliente anónimo")
    void crearPreferenciaMercadoPago_invitado_ordenPendiente_delega() {
        when(ordenesClient.obtener(611L)).thenReturn(orden(611L, "RECOJO", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.findByOrdenId(611L)).thenReturn(Optional.empty());
        PreferenceResponse pref = new PreferenceResponse("PREF", "https://mp/init", null, 1L, 611L);
        when(mercadoPagoGateway.crearPreferencia(any(IniciarPagoRequest.class), eq(0L))).thenReturn(pref);

        PreferenceResponse res = pagoService.crearPreferenciaMercadoPago(preferencia(611L, "45"), null);

        assertThat(res).isSameAs(pref);
        ArgumentCaptor<IniciarPagoRequest> captor = ArgumentCaptor.forClass(IniciarPagoRequest.class);
        verify(mercadoPagoGateway).crearPreferencia(captor.capture(), eq(0L));
        assertThat(captor.getValue().monto()).isEqualTo(new BigDecimal("45.00"));
        assertThat(captor.getValue().ordenId()).isEqualTo(611L);
    }

    @Test
    @DisplayName("T6: la preferencia MP siempre es TARJETA aunque el llamador declare otro método")
    void crearPreferenciaMercadoPago_ignoraElMetodoDelLlamador() {
        when(ordenesClient.obtener(616L)).thenReturn(orden(616L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.findByOrdenId(616L)).thenReturn(Optional.empty());

        pagoService.crearPreferenciaMercadoPago(
                new IniciarPagoRequest(616L, new BigDecimal("45.00"), MetodoPago.CONTRAENTREGA, null, null), null);

        ArgumentCaptor<IniciarPagoRequest> captor = ArgumentCaptor.forClass(IniciarPagoRequest.class);
        verify(mercadoPagoGateway).crearPreferencia(captor.capture(), eq(0L));
        assertThat(captor.getValue().metodoPago()).isEqualTo(MetodoPago.TARJETA);
    }

    @Test
    @DisplayName("PRESERVE T3: preferencia MP de un cliente logueado conserva su clienteId")
    void crearPreferenciaMercadoPago_logueado_conservaClienteId() {
        when(ordenesClient.obtener(612L)).thenReturn(orden(612L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.findByOrdenId(612L)).thenReturn(Optional.empty());

        pagoService.crearPreferenciaMercadoPago(preferencia(612L, "45.00"), 7L);

        verify(mercadoPagoGateway).crearPreferencia(any(IniciarPagoRequest.class), eq(7L));
    }

    @Test
    @DisplayName("T3: preferencia MP de una orden que no espera pago responde 409 y no crea nada")
    void crearPreferenciaMercadoPago_ordenNoPendiente_rechaza() {
        for (String estado : new String[] {
                "CANCELADO", "ENTREGADO", "PEDIDO_FANTASMA", "PENDIENTE_CONFIRMACION", "EN_PREPARACION"}) {
            when(ordenesClient.obtener(613L)).thenReturn(orden(613L, "DELIVERY", estado, "45.00"));

            assertThatThrownBy(() -> pagoService.crearPreferenciaMercadoPago(preferencia(613L, "45.00"), null))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ya no está pendiente de pago");
        }
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("T3: preferencia MP con monto distinto al total responde 400")
    void crearPreferenciaMercadoPago_montoDistinto_rechaza() {
        when(ordenesClient.obtener(614L)).thenReturn(orden(614L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));

        assertThatThrownBy(() -> pagoService.crearPreferenciaMercadoPago(preferencia(614L, "0.10"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no coincide");
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("T3: preferencia MP falla cerrado si orders-service no informa la orden")
    void crearPreferenciaMercadoPago_ordenNula_fallaCerrado() {
        when(ordenesClient.obtener(615L)).thenReturn(null);

        assertThatThrownBy(() -> pagoService.crearPreferenciaMercadoPago(preferencia(615L, "45.00"), null))
                .isInstanceOf(OrdenesClient.OrdenNoDisponibleException.class);
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("T3: preferencia MP no pisa un comprobante Yape pendiente de verificación")
    void crearPreferenciaMercadoPago_comprobanteEnVerificacion_rechaza() {
        when(ordenesClient.obtener(616L)).thenReturn(orden(616L, "DELIVERY", "PENDIENTE_PAGO", "45.00"));
        when(pagoRepository.findByOrdenId(616L)).thenReturn(Optional.of(capturaPendiente(516L, 616L)));

        assertThatThrownBy(() -> pagoService.crearPreferenciaMercadoPago(preferencia(616L, "45.00"), null))
                .isInstanceOf(IllegalStateException.class);
        verify(mercadoPagoGateway, never()).crearPreferencia(any(), any());
    }

    @Test
    @DisplayName("T3: reintentar un cobro en efectivo ya aprobado reenvía ENTREGADO si la orden no se entregó")
    void procesarCobroEfectivo_yaAprobado_reenviaEntregado() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(621L))
                .thenReturn(Optional.of(pagoAprobado(621L, MetodoPago.CONTRAENTREGA)));
        when(ordenesClient.obtener(621L)).thenReturn(orden(621L, "DELIVERY", "EN_PUERTA", "45.00"));

        PagoResponse res = pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(621L, new BigDecimal("45.00"), null, null), 4L, "Bearer r");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(notificadorOrden).notificarEstado(eq(621L), eq("ENTREGADO"), eq("Bearer r"));
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    @Test
    @DisplayName("T3: reintentar un cobro RECOJO ya aprobado reenvía ENTREGADO con el ticket")
    void procesarCobroEfectivo_yaAprobadoRecojo_reenviaEntregadoConTicket() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(622L))
                .thenReturn(Optional.of(pagoAprobado(622L, MetodoPago.CONTRAENTREGA)));
        when(ordenesClient.obtener(622L)).thenReturn(orden(622L, "RECOJO", "LISTO", "45.00"));

        pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(622L, new BigDecimal("45.00"), null, null, "POL-622"), 4L, "Bearer c");

        verify(notificadorOrden).notificarEstado(eq(622L), eq("ENTREGADO"), eq("POL-622"), eq("Bearer c"));
        verify(pagoRepository, never()).save(any(Pago.class));
    }

    @Test
    @DisplayName("PRESERVE T3: reintentar un cobro ya aprobado de una orden ENTREGADO no vuelve a notificar")
    void procesarCobroEfectivo_yaAprobadoYEntregado_noNotifica() {
        when(pagoRepository.buscarPorOrdenIdConBloqueo(623L))
                .thenReturn(Optional.of(pagoAprobado(623L, MetodoPago.CONTRAENTREGA)));
        when(ordenesClient.obtener(623L)).thenReturn(orden(623L, "DELIVERY", "ENTREGADO", "45.00"));

        PagoResponse res = pagoService.procesarCobroEfectivo(
                new CobroEfectivoRequest(623L, new BigDecimal("45.00"), null, null), 4L, "Bearer r");

        assertThat(res.estado()).isEqualTo(EstadoPago.APROBADO);
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any());
        verify(notificadorOrden, never()).notificarEstado(any(), any(), any(), any());
    }
}
