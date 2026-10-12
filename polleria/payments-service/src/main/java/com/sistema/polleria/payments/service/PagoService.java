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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final NotificadorOrden notificadorOrden;
    private final WhatsappNotificationClient whatsappNotificationClient;

    @Transactional
    public PagoResponse iniciar(IniciarPagoRequest request, Long clienteId, String bearerToken) {
        // Camino rápido, para dar un mensaje claro en el caso normal.
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

        // La comprobación de arriba es el camino rápido, pero es un check-then-act: dos pagos
        // concurrentes de la misma orden podían pasar ambos. El índice único sobre orden_id es
        // lo que realmente lo garantiza, y saveAndFlush fuerza la verificación aquí dentro.
        try {
            pago = pagoRepository.saveAndFlush(pago);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            throw new IllegalStateException("Ya existe un pago registrado para la orden " + request.ordenId());
        }

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
        // Bloqueo pesimista: dos webhooks concurrentes de Mercado Pago para el mismo pago
        // se serializan aquí. Sin él, ambos leían el pago como no aprobado y ambos confirmaban.
        Pago pago = pagoRepository.buscarConBloqueo(id)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));

        // Idempotencia: Mercado Pago reintenta los webhooks. Si el pago ya está aprobado se
        // devuelve el estado actual sin volver a notificar la orden ni reenviar el WhatsApp.
        if (pago.getEstado() == EstadoPago.APROBADO) {
            log.info("Pago id={} ya estaba APROBADO: confirmación idempotente sin notificaciones", id);
            return PagoResponse.from(pago);
        }

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
        notificarOrdenEstadoAsync(pago.getOrdenId(), "CANCELADO", "");
        log.info("Pago cancelado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsar(Long id, BigDecimal monto, String motivo) {
        Pago pago = buscar(id);
        if (pago.getEstado() != EstadoPago.APROBADO && pago.getEstado() != EstadoPago.REEMBOLSADO_PARCIAL) {
            throw new IllegalStateException("Solo se pueden reembolsar pagos que hayan sido APROBADOS. Estado actual: " + pago.getEstado());
        }

        // Si es un pago de Mercado Pago, ejecutar reembolso en la pasarela externa
        // No se traga la excepción: si Mercado Pago falla, la transacción no se consolida
        if (mercadoPagoGateway != null && mercadoPagoGateway.esPagoMercadoPago(pago)) {
            mercadoPagoGateway.procesarReembolso(pago, monto);
        }

        boolean esParcial = monto != null && monto.compareTo(pago.getMonto()) < 0;
        pago.setEstado(esParcial ? EstadoPago.REEMBOLSADO_PARCIAL : EstadoPago.REEMBOLSADO);
        pago.setDetalle((esParcial ? "Reembolso parcial" : "Reembolso") + " procesado por S/ " + (monto != null ? monto : pago.getMonto()) + ". Motivo: " + (motivo != null ? motivo : "Reclamo procedente"));
        pago = pagoRepository.save(pago);
        log.info("Pago reembolsado — id={} orden={} monto={} estado={}", pago.getId(), pago.getOrdenId(), monto, pago.getEstado());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsarPorOrden(Long ordenId, BigDecimal monto, String motivo) {
        Pago pago = pagoRepository.findByOrdenId(ordenId)
                .orElseThrow(() -> new NoSuchElementException("No existe pago asociado a la orden: " + ordenId));
        return reembolsar(pago.getId(), monto, motivo);
    }

    /**
     * Aplica un estado informado por la pasarela (webhook) tomando el bloqueo pesimista del pago.
     *
     * Antes esas ramas escribían la entidad directamente desde el controlador, sin transacción
     * ni bloqueo: un webhook {@code in_process} posterior a un {@code approved} podía degradar el
     * pago de APROBADO a PENDIENTE, y un conflicto de versión se perdía silenciosamente.
     */
    @Transactional
    public PagoResponse actualizarEstadoDesdePasarela(Long pagoId, EstadoPago nuevoEstado, String detalle) {
        Pago pago = pagoRepository.buscarConBloqueo(pagoId)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + pagoId));

        if (pago.getEstado() == EstadoPago.APROBADO && nuevoEstado == EstadoPago.PENDIENTE) {
            log.info("Se ignora el paso a PENDIENTE del pago id={}: ya estaba APROBADO", pagoId);
            return PagoResponse.from(pago);
        }
        if (pago.getEstado() == nuevoEstado) {
            return PagoResponse.from(pago);
        }

        pago.setEstado(nuevoEstado);
        pago.setDetalle(detalle);
        pago = pagoRepository.save(pago);
        log.info("Pago id={} → {} (webhook de pasarela)", pagoId, nuevoEstado);
        return PagoResponse.from(pago);
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
     * automáticamente el estado del pedido a EN_PREPARACION (RF21).
     * Se delega a {@link NotificadorOrden} para que @Async realmente se aplique.
     */
    private void notificarOrdenAsync(Long ordenId, String bearerToken) {
        notificadorOrden.notificarPagoAprobado(ordenId, bearerToken);
    }

    /**
     * Notifica cualquier cambio de estado a orders-service autenticándose con
     * la clave interna X-Internal-Key (o Bearer token si está disponible).
     */
    public void notificarOrdenEstadoAsync(Long ordenId, String nuevoEstado, String bearerToken) {
        notificadorOrden.notificarEstado(ordenId, nuevoEstado, bearerToken);
    }
}
