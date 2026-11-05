package com.sistema.polleria.payments.gateway;

import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.preference.PreferenceBackUrlsRequest;
import com.mercadopago.client.preference.PreferenceClient;
import com.mercadopago.client.preference.PreferenceItemRequest;
import com.mercadopago.client.preference.PreferenceRequest;
import com.mercadopago.exceptions.MPApiException;
import com.mercadopago.exceptions.MPException;
import com.mercadopago.resources.preference.Preference;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PreferenceResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoPagoGateway implements PaymentGateway {

    private final PagoRepository pagoRepository;

    @Value("${mercadopago.webhook.url:}")
    private String webhookUrl;

    @Value("${mercadopago.back-urls.success:https://airport-arlington-graduation-discussed.trycloudflare.com/checkout/success}")
    private String successUrl;

    @Value("${mercadopago.back-urls.failure:https://airport-arlington-graduation-discussed.trycloudflare.com/checkout/failure}")
    private String failureUrl;

    @Value("${mercadopago.back-urls.pending:https://airport-arlington-graduation-discussed.trycloudflare.com/checkout/pending}")
    private String pendingUrl;

    @Value("${mercadopago.sandbox:true}")
    private boolean sandbox;

    @Override
    public boolean supports(MetodoPago metodoPago) {
        return metodoPago == MetodoPago.TARJETA || metodoPago == MetodoPago.YAPE_PLIN;
    }

    @Override
    @Transactional
    public GatewayResult procesar(IniciarPagoRequest request, Long clienteId) {
        PreferenceResponse pref = crearPreferencia(request, clienteId);
        String redirectUrl = sandbox
                ? (pref.sandboxInitPoint() != null ? pref.sandboxInitPoint() : pref.initPoint())
                : pref.initPoint();

        return new GatewayResult(
                EstadoPago.PENDIENTE,
                pref.preferenceId(),
                "Checkout Pro generado. Redirigir a pasarela Mercado Pago",
                redirectUrl
        );
    }

    @Transactional
    public PreferenceResponse crearPreferencia(IniciarPagoRequest request, Long clienteId) {
        log.info("Creando preferencia de Mercado Pago para ordenId={}, clienteId={}, monto={}",
                request.ordenId(), clienteId, request.monto());

        // 1. Obtener o registrar la entidad Pago
        Optional<Pago> pagoExistente = pagoRepository.findByOrdenId(request.ordenId());
        Pago pago;
        if (pagoExistente.isPresent()) {
            pago = pagoExistente.get();
            if (pago.getEstado() == EstadoPago.APROBADO) {
                throw new IllegalStateException("La orden " + request.ordenId() + " ya tiene un pago aprobado.");
            }
            pago.setMonto(request.monto());
            pago.setMetodoPago(request.metodoPago() != null ? request.metodoPago() : MetodoPago.TARJETA);
            pago.setEstado(EstadoPago.PENDIENTE);
        } else {
            pago = new Pago();
            pago.setOrdenId(request.ordenId());
            pago.setClienteId(clienteId);
            pago.setMonto(request.monto());
            pago.setMetodoPago(request.metodoPago() != null ? request.metodoPago() : MetodoPago.TARJETA);
            pago.setEstado(EstadoPago.PENDIENTE);
        }
        pago = pagoRepository.save(pago);

        // 2. Construir el Item del pedido
        PreferenceItemRequest itemRequest = PreferenceItemRequest.builder()
                .id(String.valueOf(request.ordenId()))
                .title("Pedido #" + request.ordenId() + " - El San Pollo")
                .description("Consumo en restaurante / pollería")
                .quantity(1)
                .currencyId("PEN")
                .unitPrice(request.monto())
                .build();

        // 3. URLs de retorno para redirección del cliente
        String safeSuccessUrl = (successUrl != null && !successUrl.isBlank()) ? successUrl : "http://localhost:4200/checkout/success";
        String safeFailureUrl = (failureUrl != null && !failureUrl.isBlank()) ? failureUrl : "http://localhost:4200/checkout/failure";
        String safePendingUrl = (pendingUrl != null && !pendingUrl.isBlank()) ? pendingUrl : "http://localhost:4200/checkout/pending";

        log.debug("Back URLs → success={}, failure={}, pending={}", safeSuccessUrl, safeFailureUrl, safePendingUrl);

        PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                .success(safeSuccessUrl)
                .failure(safeFailureUrl)
                .pending(safePendingUrl)
                .build();

        // 4. Armar la solicitud de preferencia
        PreferenceRequest.PreferenceRequestBuilder preferenceBuilder = PreferenceRequest.builder()
                .items(List.of(itemRequest))
                .backUrls(backUrls)
                .autoReturn("approved")
                .externalReference(String.valueOf(pago.getId()));

        if (webhookUrl != null && !webhookUrl.isBlank()) {
            preferenceBuilder.notificationUrl(webhookUrl);
        }

        PreferenceRequest preferenceRequest = preferenceBuilder.build();

        try {
            PreferenceClient client = new PreferenceClient();
            Preference preference = client.create(preferenceRequest);

            String redirectUrl = sandbox
                    ? (preference.getSandboxInitPoint() != null ? preference.getSandboxInitPoint() : preference.getInitPoint())
                    : preference.getInitPoint();

            pago.setReferenciaExterna(preference.getId());
            pago.setDetalle("Preferencia Mercado Pago generada: " + preference.getId());
            pago.setCheckoutUrl(redirectUrl);
            pagoRepository.save(pago);

            log.info("Preferencia creada con éxito. ID: {}, initPoint: {}",
                    preference.getId(), redirectUrl);

            return new PreferenceResponse(
                    preference.getId(),
                    preference.getInitPoint(),
                    preference.getSandboxInitPoint(),
                    pago.getId(),
                    request.ordenId()
            );

        } catch (MPApiException apiException) {
            log.error("Error API Mercado Pago (status={}): {}",
                    apiException.getStatusCode(), apiException.getApiResponse().getContent());
            throw new RuntimeException("Error en pasarela Mercado Pago: " + apiException.getApiResponse().getContent(), apiException);
        } catch (MPException mpException) {
            log.error("Error SDK Mercado Pago: {}", mpException.getMessage());
            throw new RuntimeException("Error al conectar con Mercado Pago: " + mpException.getMessage(), mpException);
        }
    }

    public boolean esPagoMercadoPago(Pago pago) {
        if (pago == null) return false;
        String ref = pago.getReferenciaExterna();
        String detalle = pago.getDetalle();
        return (ref != null && (ref.startsWith("MP-") || ref.matches("^\\d+$") || ref.contains("-")))
                || (detalle != null && detalle.toLowerCase().contains("mercado pago"));
    }

    public void procesarReembolso(Pago pago, BigDecimal monto) {
        log.info("Procesando reembolso en Mercado Pago para pagoId={}, ordenId={}", pago.getId(), pago.getOrdenId());
        String ref = pago.getReferenciaExterna();
        if (ref == null || ref.isBlank()) {
            log.warn("El pago ID={} no cuenta con referencia de Mercado Pago", pago.getId());
            return;
        }

        Long mpPaymentId = null;
        try {
            if (ref.startsWith("MP-")) {
                mpPaymentId = Long.parseLong(ref.substring(3).trim());
            } else if (ref.matches("^\\d+$")) {
                mpPaymentId = Long.parseLong(ref.trim());
            }
        } catch (NumberFormatException e) {
            log.warn("No se pudo extraer el ID numérico de Mercado Pago de '{}': {}", ref, e.getMessage());
        }

        if (mpPaymentId != null) {
            try {
                PaymentClient client = new PaymentClient();
                if (monto != null) {
                    var refund = client.refund(mpPaymentId, monto);
                    log.info("Reembolso parcial exitoso en Mercado Pago: refundId={}, status={}", refund.getId(), refund.getStatus());
                } else {
                    var refund = client.refund(mpPaymentId);
                    log.info("Reembolso total exitoso en Mercado Pago: refundId={}, status={}", refund.getId(), refund.getStatus());
                }
            } catch (MPApiException apiException) {
                log.error("Error API Mercado Pago al reembolsar (status={}): {}",
                        apiException.getStatusCode(), apiException.getApiResponse().getContent());
                throw new RuntimeException("Error en Mercado Pago al procesar reembolso: " + apiException.getApiResponse().getContent(), apiException);
            } catch (MPException mpException) {
                log.error("Error SDK Mercado Pago al reembolsar: {}", mpException.getMessage());
                throw new RuntimeException("Error al conectar con Mercado Pago para reembolso: " + mpException.getMessage(), mpException);
            }
        } else {
            log.info("Pago ID={} con referencia '{}' registrado para reembolso", pago.getId(), ref);
        }
    }
}
