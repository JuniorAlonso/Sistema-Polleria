package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.RegistrarComprobanteRequest;
import com.sistema.polleria.payments.dto.VerificarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
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
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;
    private final PaymentGatewayService paymentGatewayService;
    private final MercadoPagoGateway mercadoPagoGateway;
    private final NotificadorOrden notificadorOrden;
    private final WhatsappNotificationClient whatsappNotificationClient;

    /**
     * Id del cliente para los pedidos anónimos de WhatsApp (S1): no hay cuenta y
     * {@code Pago.clienteId} es NOT NULL. Mismo centinela que usa el propio servicio cuando
     * no puede resolver un usuario autenticado.
     */
    private static final long CLIENTE_ANONIMO = 0L;

    /**
     * Estados en los que un comprobante nuevo todavía puede reemplazar al anterior.
     *
     * <p>{@code PENDIENTE} es el estado de la evidencia inicial; {@code PENDIENTE_VERIFICACION} es
     * un reintento mientras el admin todavía no decidió. {@code RECHAZADO} se sumó en T6c: el
     * índice único {@code uq_pagos_orden_id} impide un segundo pago para la misma orden, así que un
     * comprobante rechazado que no se pudiera reemplazar dejaría el pedido imposible de pagar por
     * Yape. Reemplazarlo no deshace la decisión del admin: reinicia la verificación con evidencia
     * nueva. {@code APROBADO}, {@code CANCELADO} y los reembolsos no se pisan nunca: no se deshace
     * un cobro.
     */
    private static final Set<EstadoPago> ESTADOS_VERIFICABLES =
            EnumSet.of(EstadoPago.PENDIENTE, EstadoPago.PENDIENTE_VERIFICACION, EstadoPago.RECHAZADO);

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

    /**
     * Registra la evidencia de un pago por Yape hecho por WhatsApp (T6a, S6) y lo deja en
     * {@link EstadoPago#PENDIENTE_VERIFICACION} para que el admin lo verifique (T6c).
     *
     * <p>Criterio de idempotencia: mientras el pago siga en un estado verificable
     * ({@code PENDIENTE}, {@code PENDIENTE_VERIFICACION} o {@code RECHAZADO}) un registro nuevo
     * reemplaza el comprobante anterior y la orden conserva un único pago. Si el pago ya está
     * aprobado, cancelado o reembolsado, la llamada es un no-op idempotente: devuelve el pago tal
     * como está y no pisa la decisión del admin. Un reintento del notification-service (T6b)
     * siempre encuentra el mismo pago.
     *
     * <p>Que {@code RECHAZADO} sea reemplazable es la corrección de T6c sobre la idempotencia de
     * T6a: el rechazo deja el pedido impago esperando un comprobante válido (L16) y el índice
     * único {@code uq_pagos_orden_id} impide crear un segundo pago, así que sin esta regla el
     * cliente no tendría forma de reintentar el Yape.
     *
     * <p>Solo se guarda la clave del objeto en el bucket; el archivo lo sube el
     * notification-service. No se notifica a orders-service: el pedido avanza al aprobar (T6c).
     */
    @Transactional
    public PagoResponse registrarComprobante(RegistrarComprobanteRequest request) {
        Pago existente = pagoRepository.findByOrdenId(request.ordenId()).orElse(null);

        if (existente != null && !ESTADOS_VERIFICABLES.contains(existente.getEstado())) {
            log.info("Comprobante ignorado: la orden {} ya tiene un pago en estado {}",
                    request.ordenId(), existente.getEstado());
            return PagoResponse.from(existente);
        }

        boolean esNuevo = existente == null;
        Pago pago = esNuevo ? new Pago() : existente;
        if (esNuevo) {
            pago.setOrdenId(request.ordenId());
            pago.setClienteId(CLIENTE_ANONIMO);
            pago.setMonto(request.monto() != null ? request.monto() : BigDecimal.ZERO);
        } else if (request.monto() != null) {
            pago.setMonto(request.monto());
        }

        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pago.setEstado(EstadoPago.PENDIENTE_VERIFICACION);
        pago.setComprobanteClave(request.comprobanteClave());
        pago.setDetalle("Comprobante de Yape recibido por WhatsApp, pendiente de verificación del admin");
        // Un comprobante nuevo reinicia la verificación: la decisión anterior ya no aplica.
        pago.setVerificadoPor(null);
        pago.setVerificadoEn(null);
        pago.setMotivoRechazo(null);

        try {
            pago = pagoRepository.saveAndFlush(pago);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Carrera entre dos registros concurrentes de la misma orden: el índice único
            // uq_pagos_orden_id deja un solo pago y el perdedor recibe 409.
            throw new IllegalStateException("Ya existe un pago registrado para la orden " + request.ordenId());
        }

        log.info("Comprobante de Yape registrado — pago id={} orden={} nuevo={}",
                pago.getId(), pago.getOrdenId(), esNuevo);
        return PagoResponse.from(pago);
    }

    /**
     * Verificación del comprobante de Yape por parte del administrador (T6c, S6). Es exclusiva del
     * rol {@code ADMIN} (la autorización la aplica {@code PagoController} con {@code @PreAuthorize});
     * aquí solo se aplica la decisión.
     *
     * <p><b>Aprobar</b>: el pago pasa a {@link EstadoPago#APROBADO} y el pedido avanza con el
     * **mismo mecanismo** que usa el pago aprobado de Mercado Pago
     * ({@code notificarOrdenAsync → NotificadorOrden.notificarPagoAprobado}, que mueve la orden a
     * {@code EN_PREPARACION}). No se inventa otro camino.
     *
     * <p><b>Rechazar</b>: el pago pasa a {@link EstadoPago#RECHAZADO} con el motivo obligatorio y
     * la orden **no** avanza: queda impaga esperando un comprobante válido que el cliente puede
     * volver a mandar (ver la idempotencia de {@code registrarComprobante}).
     *
     * <p>Toma el bloqueo pesimista del pago: dos administradores verificando a la vez no pueden
     * aplicar dos decisiones distintas.
     */
    @Transactional
    public PagoResponse verificar(Long id, VerificarPagoRequest request, String adminEmail, String bearerToken) {
        Pago pago = pagoRepository.buscarConBloqueo(id)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));

        if (pago.getEstado() != EstadoPago.PENDIENTE_VERIFICACION) {
            throw new IllegalStateException(
                    "Solo se puede verificar un comprobante PENDIENTE_VERIFICACION. Estado actual: "
                            + pago.getEstado());
        }

        if (!Boolean.TRUE.equals(request.aprobado())) {
            String motivo = request.motivoRechazo() != null ? request.motivoRechazo().trim() : "";
            if (motivo.isEmpty()) {
                throw new IllegalArgumentException("El motivo de rechazo es obligatorio");
            }
            pago.setEstado(EstadoPago.RECHAZADO);
            pago.setMotivoRechazo(motivo);
            pago.setVerificadoPor(adminEmail);
            pago.setVerificadoEn(LocalDateTime.now());
            pago.setDetalle("Comprobante de Yape rechazado por el administrador: " + motivo);
            pago = pagoRepository.save(pago);
            log.info("Comprobante rechazado — pago id={} orden={} admin={}",
                    pago.getId(), pago.getOrdenId(), adminEmail);
            return PagoResponse.from(pago);
        }

        pago.setEstado(EstadoPago.APROBADO);
        pago.setMotivoRechazo(null);
        pago.setVerificadoPor(adminEmail);
        pago.setVerificadoEn(LocalDateTime.now());
        pago.setDetalle("Comprobante de Yape verificado por el administrador");
        pago = pagoRepository.save(pago);

        // RF21: mismo camino que el pago aprobado de Mercado Pago (confirmar/iniciar).
        notificarOrdenAsync(pago.getOrdenId(), bearerToken);
        log.info("Comprobante aprobado — pago id={} orden={} admin={}",
                pago.getId(), pago.getOrdenId(), adminEmail);
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
