package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.gateway.GatewayResult;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.gateway.PaymentGateway;
import com.sistema.polleria.payments.gateway.PaymentGatewayService;
import com.sistema.polleria.payments.repository.PagoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;
    private final PaymentGatewayService paymentGatewayService;
    private final MercadoPagoGateway mercadoPagoGateway;
    private final RestClient ordersRestClient;
    private final WhatsappNotificationClient whatsappNotificationClient;

    // Clave compartida con orders-service; permite avisar del pago sin JWT (p. ej. desde el webhook)
    @Value("${orders.service.internal-key:}")
    private String ordersInternalKey;

    @Transactional
    public PagoResponse iniciar(IniciarPagoRequest request, Long clienteId, String bearerToken) {
        if (pagoRepository.findByOrdenId(request.ordenId()).isPresent()) {
            throw new IllegalStateException("Ya existe un pago registrado para la orden " + request.ordenId());
        }

        com.sistema.polleria.payments.gateway.PaymentGateway gateway = paymentGatewayService.seleccionar(request.metodoPago());
        GatewayResult result = gateway.procesar(request, clienteId);

        Pago pago = new Pago();
        pago.setOrdenId(request.ordenId());
        pago.setClienteId(clienteId);
        pago.setMonto(request.monto());
        pago.setMetodoPago(request.metodoPago());
        pago.setEstado(result.estado());
        pago.setReferenciaExterna(result.referenciaExterna());
        pago.setDetalle(result.detalle());
        pago.setCheckoutUrl(result.checkoutUrl());
        pago = pagoRepository.save(pago);

        if (result.estado() == EstadoPago.APROBADO) {
            notificarOrdenAsync(request.ordenId(), bearerToken);
            whatsappNotificationClient.notificarPagoConfirmado(pago.getOrdenId(), pago.getMonto(), pago.getMetodoPago());
        }

        log.info("Pago iniciado — id={} orden={} método={} estado={} checkoutUrl={}",
                pago.getId(), pago.getOrdenId(), pago.getMetodoPago(), pago.getEstado(), pago.getCheckoutUrl());

        return PagoResponse.from(pago);
    }

    public PagoResponse obtener(Long id) {
        return PagoResponse.from(buscar(id));
    }

    public PagoResponse obtenerPorOrden(Long ordenId) {
        return PagoResponse.from(
            pagoRepository.findByOrdenId(ordenId)
                .orElseThrow(() -> new NoSuchElementException("No hay pago para la orden " + ordenId))
        );
    }

    public List<PagoResponse> misOrdenes(Long clienteId) {
        return pagoRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(PagoResponse::from).toList();
    }

    public List<PagoResponse> todos() {
        return pagoRepository.findAllByOrderByCreadoEnDesc()
                .stream().map(PagoResponse::from).toList();
    }

    @Transactional
    public PagoResponse confirmar(Long id, ConfirmarPagoRequest req, String bearerToken) {
        Pago pago = buscar(id);
        validarTransicion(pago.getEstado(), EstadoPago.APROBADO);
        pago.setEstado(EstadoPago.APROBADO);
        pago.setReferenciaExterna(req.referenciaExterna());
        pago.setDetalle(req.detalle());
        pago = pagoRepository.save(pago);
        notificarOrdenAsync(pago.getOrdenId(), bearerToken);
        whatsappNotificationClient.notificarPagoConfirmado(pago.getOrdenId(), pago.getMonto(), pago.getMetodoPago());
        log.info("Pago confirmado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse cancelar(Long id) {
        Pago pago = buscar(id);
        validarTransicion(pago.getEstado(), EstadoPago.CANCELADO);
        pago.setEstado(EstadoPago.CANCELADO);
        pago.setDetalle("Pago cancelado");
        pago = pagoRepository.save(pago);
        log.info("Pago cancelado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsar(Long id, BigDecimal monto, String motivo) {
        Pago pago = buscar(id);
        if (pago.getEstado() != EstadoPago.APROBADO) {
            throw new IllegalStateException("Solo se pueden reembolsar pagos que hayan sido APROBADOS. Estado actual: " + pago.getEstado());
        }

        // Si es un pago de Mercado Pago, ejecutar reembolso en la pasarela externa
        if (mercadoPagoGateway != null && mercadoPagoGateway.esPagoMercadoPago(pago)) {
            try {
                mercadoPagoGateway.procesarReembolso(pago, monto);
            } catch (Exception e) {
                log.warn("Advertencia al procesar reembolso en Mercado Pago (se continuará con el registro local): {}", e.getMessage());
            }
        }

        pago.setEstado(EstadoPago.REEMBOLSADO);
        pago.setDetalle("Reembolso procesado por S/ " + (monto != null ? monto : pago.getMonto()) + ". Motivo: " + (motivo != null ? motivo : "Reclamo procedente"));
        pago = pagoRepository.save(pago);
        log.info("Pago reembolsado — id={} orden={} monto={}", pago.getId(), pago.getOrdenId(), monto);
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsarPorOrden(Long ordenId, BigDecimal monto, String motivo) {
        Pago pago = pagoRepository.findByOrdenId(ordenId)
                .orElseThrow(() -> new NoSuchElementException("No existe pago asociado a la orden: " + ordenId));
        return reembolsar(pago.getId(), monto, motivo);
    }

    // ─── helpers ────────────────────────────────────────────────────

    private Pago buscar(Long id) {
        return pagoRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));
    }

    private void validarTransicion(EstadoPago actual, EstadoPago nuevo) {
        if (actual == EstadoPago.APROBADO || actual == EstadoPago.CANCELADO) {
            throw new IllegalStateException(
                "No se puede cambiar un pago en estado " + actual + " a " + nuevo);
        }
    }

    /**
     * Notifica a orders-service que el pago fue aprobado para avanzar
     * automáticamente el estado del pedido (RF21).
     */
    @Async
    protected void notificarOrdenAsync(Long ordenId, String bearerToken) {
        log.info("Pago aprobado para orden {} — notificando a orders-service", ordenId);
        if (ordersRestClient != null) {
            try {
                var spec = ordersRestClient.patch()
                        .uri("/ordenes/{id}/estado", ordenId)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .body(java.util.Map.of("estado", "EN_PREPARACION"));
                if (ordersInternalKey != null && !ordersInternalKey.isBlank()) {
                    spec.header("X-Internal-Key", ordersInternalKey);
                }
                if (bearerToken != null && !bearerToken.isBlank()) {
                    spec.header("Authorization", bearerToken.startsWith("Bearer ") ? bearerToken : "Bearer " + bearerToken);
                }
                spec.retrieve().toBodilessEntity();
                log.info("Orden {} actualizada automáticamente a EN_PREPARACION en orders-service", ordenId);
            } catch (Exception e) {
                log.warn("No se pudo notificar automáticamente a orders-service para orden {}: {}", ordenId, e.getMessage());
            }
        }
    }
}
