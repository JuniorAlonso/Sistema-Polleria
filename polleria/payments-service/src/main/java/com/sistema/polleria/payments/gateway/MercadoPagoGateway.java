package com.sistema.polleria.payments.gateway;

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

import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class MercadoPagoGateway {

    private final PagoRepository pagoRepository;

    @Value("${mercadopago.webhook.url}")
    private String webhookUrl;

    @Value("${mercadopago.back-urls.success}")
    private String successUrl;

    @Value("${mercadopago.back-urls.failure}")
    private String failureUrl;

    @Value("${mercadopago.back-urls.pending}")
    private String pendingUrl;

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
        String safeSuccessUrl = (successUrl != null && !successUrl.isBlank()) ? successUrl : "http://localhost:4200/tracking";
        String safeFailureUrl = (failureUrl != null && !failureUrl.isBlank()) ? failureUrl : "http://localhost:4200/checkout?status=failure";
        String safePendingUrl = (pendingUrl != null && !pendingUrl.isBlank()) ? pendingUrl : "http://localhost:4200/checkout?status=pending";

        log.debug("Back URLs → success={}, failure={}, pending={}", safeSuccessUrl, safeFailureUrl, safePendingUrl);

        PreferenceBackUrlsRequest backUrls = PreferenceBackUrlsRequest.builder()
                .success(safeSuccessUrl)
                .failure(safeFailureUrl)
                .pending(safePendingUrl)
                .build();

        // 4. Armar la solicitud de preferencia (sin autoReturn para sandbox/localhost)
        PreferenceRequest.PreferenceRequestBuilder preferenceBuilder = PreferenceRequest.builder()
                .items(List.of(itemRequest))
                .backUrls(backUrls)
                .externalReference(String.valueOf(pago.getId()));

        if (webhookUrl != null && !webhookUrl.isBlank()) {
            preferenceBuilder.notificationUrl(webhookUrl);
        }

        PreferenceRequest preferenceRequest = preferenceBuilder.build();

        try {
            PreferenceClient client = new PreferenceClient();
            Preference preference = client.create(preferenceRequest);

            pago.setReferenciaExterna(preference.getId());
            pago.setDetalle("Preferencia Mercado Pago generada: " + preference.getId());
            pagoRepository.save(pago);

            log.info("Preferencia creada con éxito. ID: {}, initPoint: {}",
                    preference.getId(), preference.getInitPoint());

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
}
