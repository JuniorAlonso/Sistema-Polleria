package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.CobroEfectivoRequest;
import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.EfectivoPendienteResponse;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

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
    private final OrdenesClient ordenesClient;
    private final AlmacenComprobantes almacenComprobantes;

    /**
     * Minutes, counted from the order creation, during which a Yape/Plin capture can still be
     * approved. Matches the 15-minute PENDIENTE_PAGO timeout of orders-service.
     */
    @Value("${pagos.comprobante.ventana-minutos:15}")
    private long ventanaMinutos = 15;

    private static final Set<String> ESTADOS_ORDEN_TERMINALES = Set.of("CANCELADO", "ENTREGADO", "PEDIDO_FANTASMA");

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
            throw new IllegalStateException(mensajeDeIntegridad(request.ordenId(), e));
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
        // S3: a WhatsApp capture for a closed order is rejected (fail closed if orders cannot answer).
        OrdenesClient.OrdenInfo orden = obtenerOrden(request.ordenId());
        if (orden.estado() != null && ESTADOS_ORDEN_TERMINALES.contains(orden.estado())) {
            throw new IllegalStateException("El pedido #" + request.ordenId() + " ya no está activo (estado "
                    + orden.estado() + "): no admite comprobantes de pago");
        }
        return registrarComprobante(request, CLIENTE_ANONIMO);
    }

    /**
     * Same as {@link #registrarComprobante(RegistrarComprobanteRequest)} but records the owner of
     * the pago when it is created (web upload by an authenticated customer).
     */
    @Transactional
    public PagoResponse registrarComprobante(RegistrarComprobanteRequest request, long clienteId) {
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
            pago.setClienteId(clienteId);
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
            // uq_pagos_orden_id deja un solo pago y el perdedor recibe 409. Cualquier otra
            // violación es otra cosa (por ejemplo un CHECK desactualizado) y se informa como tal.
            throw new IllegalStateException(mensajeDeIntegridad(request.ordenId(), e));
        }

        log.info("Comprobante de Yape registrado — pago id={} orden={} nuevo={}",
                pago.getId(), pago.getOrdenId(), esNuevo);
        return PagoResponse.from(pago);
    }

    /**
     * Web upload of the payment capture (S3). The order is read from orders-service (fail closed if
     * it cannot be read): a customer may only upload to their own order, staff to any; closed orders
     * are rejected. The file is stored in the shared bucket and then registered through
     * {@link #registrarComprobante(RegistrarComprobanteRequest, long)}, so the pago ends in
     * {@code PENDIENTE_VERIFICACION} with the same invariants as the WhatsApp path.
     */
    public PagoResponse subirComprobanteWeb(Long ordenId, MultipartFile archivo, Long usuarioId, boolean esPersonal) {
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(ordenId);
        if (!esPersonal && (usuarioId == null || !usuarioId.equals(orden.clienteId()))) {
            // 404 instead of 403 so order ids of other customers are not revealed.
            throw new NoSuchElementException("Orden no encontrada: " + ordenId);
        }
        if (orden.estado() != null && ESTADOS_ORDEN_TERMINALES.contains(orden.estado())) {
            throw new IllegalStateException(
                    "La orden " + ordenId + " está en estado " + orden.estado() + " y ya no admite comprobantes");
        }
        String clave = almacenComprobantes.guardar(ordenId, archivo);
        long duenio = orden.clienteId() != null ? orden.clienteId() : CLIENTE_ANONIMO;
        return registrarComprobante(new RegistrarComprobanteRequest(ordenId, null, orden.total(), clave), duenio);
    }

    /**
     * Verificación del comprobante de Yape por el personal (S3). La ejecutan {@code ADMIN} y
     * {@code CAJERO} (la autorización la aplica {@code PagoController} con {@code @PreAuthorize});
     * aquí solo se aplica la decisión. Aprobar exige una captura adjunta y que no hayan pasado
     * {@code pagos.comprobante.ventana-minutos} minutos desde la creación de la orden (HTTP 400);
     * rechazar sigue permitido. Aprobar también exige que orders-service informe la orden todavía
     * en {@code PENDIENTE_PAGO} (S2, HTTP 409; si no responde, falla cerrado).
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
     * <p><b>Orden del rechazo (T6d):</b> el aviso al cliente por WhatsApp se encola **después de
     * que la transacción confirma** ({@link TransactionSynchronization#afterCommit()}), no antes.
     * Así una caída del notification-service no puede revertir el rechazo ni romper la respuesta al
     * admin: el pago ya quedó {@code RECHAZADO} y el aviso es best-effort. El aviso reutiliza
     * {@link WhatsappNotificationClient}, el mismo cliente HTTP del pago aprobado de Mercado Pago.
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
            // El aviso sale recién cuando la transacción confirma (ver afterCommit más abajo).
            avisarRechazoTrasConfirmar(pago.getOrdenId(), motivo);
            log.info("Comprobante rechazado — pago id={} orden={} admin={}",
                    pago.getId(), pago.getOrdenId(), adminEmail);
            return PagoResponse.from(pago);
        }

        if (pago.getComprobanteClave() == null || pago.getComprobanteClave().isBlank()) {
            throw new IllegalArgumentException(
                    "No se puede confirmar el pago: el cliente aún no adjuntó la captura del comprobante");
        }
        // S2: the order may have expired (or been cancelled) while the capture waited; approving it
        // then would charge a dead order. Fail closed when orders-service cannot answer.
        OrdenesClient.OrdenInfo orden = obtenerOrden(pago.getOrdenId());
        if (!"PENDIENTE_PAGO".equals(orden.estado())) {
            throw new IllegalStateException("El pedido #" + pago.getOrdenId() + " ya no está pendiente de pago "
                    + "(estado " + orden.estado() + "): no se puede aprobar el comprobante");
        }
        LocalDateTime inicioVentana = orden.creadoEn() != null ? orden.creadoEn() : pago.getCreadoEn();
        if (LocalDateTime.now().isAfter(inicioVentana.plusMinutes(ventanaMinutos))) {
            throw new IllegalArgumentException(
                    "Pasaron más de " + ventanaMinutos + " minutos desde que se creó el pedido: "
                            + "ya no se puede confirmar este pago");
        }

        pago.setEstado(EstadoPago.APROBADO);
        pago.setMotivoRechazo(null);
        pago.setVerificadoPor(adminEmail);
        pago.setVerificadoEn(LocalDateTime.now());
        pago.setDetalle("Comprobante de Yape verificado por el administrador");
        pago = pagoRepository.save(pago);

        // RF21 / RF30: mismo camino que el pago aprobado de Mercado Pago (confirmar/iniciar).
        notificarOrdenAsync(pago.getOrdenId(), bearerToken);
        avisarAprobacionTrasConfirmar(pago.getOrdenId(), pago.getMonto(), pago.getMetodoPago());
        log.info("Comprobante aprobado — pago id={} orden={} admin={}",
                pago.getId(), pago.getOrdenId(), adminEmail);
        return PagoResponse.from(pago);
    }

    public PagoResponse obtener(Long id) {
        return PagoResponse.from(buscar(id));
    }

    /**
     * Traduce una violación de integridad <b>sin mentir sobre la causa</b>. El índice único
     * {@code uq_pagos_orden_id} significa «ya hay un pago para esa orden», pero un CHECK
     * desactualizado —por ejemplo {@code pagos_estado_check} sin el estado nuevo— es un problema de
     * esquema, y responder «ya existe un pago» manda a buscar el problema al lugar equivocado. Pasó
     * exactamente eso con la primera evidencia real de Yape contra una base que ya existía.
     */
    private String mensajeDeIntegridad(Long ordenId, org.springframework.dao.DataIntegrityViolationException e) {
        String detalle = String.valueOf(e.getMostSpecificCause().getMessage());
        if (detalle.contains("uq_pagos_orden_id")) {
            return "Ya existe un pago registrado para la orden " + ordenId;
        }
        log.error("Violación de integridad al guardar el pago de la orden {}: {}", ordenId, detalle);
        String recorte = detalle.length() > 200 ? detalle.substring(0, 200) : detalle;
        return "No se pudo guardar el pago: la base rechazó el estado. Detalle: " + recorte;
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
        return todos(null);
    }

    /** Lists pagos newest first, optionally filtered by estado (cashier inbox: PENDIENTE_VERIFICACION). */
    public List<PagoResponse> todos(EstadoPago estado) {
        List<Pago> pagos = estado == null
                ? pagoRepository.findAllByOrderByCreadoEnDesc()
                : pagoRepository.findByEstadoOrderByCreadoEnDesc(estado);
        return pagos.stream().map(PagoResponse::from).toList();
    }

    /** Reads the order from orders-service; an empty answer is treated as unavailable (fail closed). */
    private OrdenesClient.OrdenInfo obtenerOrden(Long ordenId) {
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(ordenId);
        if (orden == null) {
            throw new OrdenesClient.OrdenNoDisponibleException(
                    "No se pudo verificar la orden " + ordenId + " en este momento. Intenta nuevamente.", null);
        }
        return orden;
    }

    /** Pickup ticket comparison (S7): case-insensitive, ignoring spaces and dashes. */
    private static String normalizarTicket(String ticket) {
        return ticket == null ? "" : ticket.replaceAll("[\\s-]", "").toUpperCase(java.util.Locale.ROOT);
    }

    private static boolean cobroEfectivoPermitido(OrdenesClient.OrdenInfo orden) {
        String estado = orden.estado() == null ? "" : orden.estado();
        String tipo = orden.tipo() == null ? "" : orden.tipo();
        return switch (tipo) {
            case "DELIVERY" -> estado.equals("EN_PUERTA") || estado.equals("EN_CAMINO");
            case "RECOJO" -> estado.equals("LISTO") || estado.equals("LISTO_PARA_ENTREGAR");
            default -> false;
        };
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

    /**
     * T6d (S6/S13) — Encola el aviso de rechazo al cliente **después de que la transacción
     * confirma**. El orden importa: hasta que el commit no ocurre, el rechazo no está guardado, y
     * el aviso no debe poder romperlo. Con {@code afterCommit}, si la transacción se revierte el
     * aviso no sale, y si el aviso falla el rechazo ya está persistido.
     *
     * <p>El callback envuelve la llamada en try/catch por si el cliente HTTP lanza: una excepción
     * dentro de {@code afterCommit} se propagaría al commit y convertiría una respuesta correcta en
     * un 500. El aviso es best-effort y nunca condiciona la verificación.
     */
    private void avisarRechazoTrasConfirmar(Long ordenId, String motivo) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            // Fuera de una transacción no hay nada que ordenar: el rechazo ya está persistido.
            encolarAvisoRechazo(ordenId, motivo);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                encolarAvisoRechazo(ordenId, motivo);
            }
        });
    }

    private void encolarAvisoRechazo(Long ordenId, String motivo) {
        try {
            whatsappNotificationClient.notificarComprobanteRechazado(ordenId, motivo);
        } catch (Exception e) {
            log.warn("No se pudo encolar el aviso de rechazo para la orden {}: {}", ordenId, e.getMessage());
        }
    }

    private void avisarAprobacionTrasConfirmar(Long ordenId, BigDecimal monto, MetodoPago metodoPago) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            encolarAvisoAprobacion(ordenId, monto, metodoPago);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                encolarAvisoAprobacion(ordenId, monto, metodoPago);
            }
        });
    }

    private void encolarAvisoAprobacion(Long ordenId, BigDecimal monto, MetodoPago metodoPago) {
        try {
            whatsappNotificationClient.notificarPagoConfirmado(ordenId, monto, metodoPago);
        } catch (Exception e) {
            log.warn("No se pudo encolar el aviso de pago aprobado para la orden {}: {}", ordenId, e.getMessage());
        }
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

    /**
     * Preferencia de Mercado Pago (Checkout Pro) para el checkout web, también para invitados (T3/S1).
     * Como el endpoint es público, nunca se confía en el llamador: la orden debe seguir en
     * {@code PENDIENTE_PAGO} (409), el monto declarado debe ser su total (400) y se cobra el total que
     * informa orders-service; si la orden no se puede leer, falla cerrado (503). Tampoco pisa un
     * comprobante Yape que el cajero todavía tiene que verificar.
     */
    @Transactional
    public com.sistema.polleria.payments.dto.PreferenceResponse crearPreferenciaMercadoPago(
            IniciarPagoRequest request, Long clienteId) {
        OrdenesClient.OrdenInfo orden = obtenerOrden(request.ordenId());
        exigirPendienteDePago(request.ordenId(), orden);
        if (orden.total() == null || orden.total().compareTo(request.monto()) != 0) {
            throw new IllegalArgumentException(
                    "El monto no coincide con el total del pedido (S/ " + orden.total() + ")");
        }
        pagoRepository.findByOrdenId(request.ordenId())
                .filter(p -> p.getEstado() == EstadoPago.PENDIENTE_VERIFICACION)
                .ifPresent(p -> {
                    throw new IllegalStateException("El pedido #" + request.ordenId()
                            + " tiene un comprobante Yape pendiente de verificación");
                });
        // Checkout Pro is always a card payment: a public caller must not rewrite the pago's method.
        IniciarPagoRequest conTotal = new IniciarPagoRequest(request.ordenId(), orden.total(),
                MetodoPago.TARJETA, request.tokenPasarela(), request.telefonoYape());
        return mercadoPagoGateway.crearPreferencia(conTotal, clienteId != null ? clienteId : CLIENTE_ANONIMO);
    }

    /** Only an order still waiting for its online payment can be charged (S2/T3, HTTP 409). */
    private static void exigirPendienteDePago(Long ordenId, OrdenesClient.OrdenInfo orden) {
        if (!"PENDIENTE_PAGO".equals(orden.estado())) {
            throw new IllegalStateException("El pedido #" + ordenId + " ya no está pendiente de pago "
                    + "(estado " + orden.estado() + ")");
        }
    }

    /**
     * Cobro directo mediante Yape integrado en Mercado Pago (Checkout transparente vía OTP).
     * Si es aprobado, avanza DIRECTO la orden a PREPARANDO en cocina.
     */
    @Transactional
    public PagoResponse procesarYapeOtp(YapeOtpPagoRequest request, Long clienteId, String bearerToken) {
        log.info("Procesando pago directo Yape OTP para orden={}, celular={}, monto=S/ {}",
                request.ordenId(), request.telefono(), request.monto());

        // S5: the amount charged must be the order total, never what the (public) caller declares.
        OrdenesClient.OrdenInfo orden = obtenerOrden(request.ordenId());
        if (orden.total() == null || orden.total().compareTo(request.monto()) != 0) {
            throw new IllegalArgumentException(
                    "El monto no coincide con el total del pedido (S/ " + orden.total() + ")");
        }

        Pago pago = pagoRepository.buscarPorOrdenIdConBloqueo(request.ordenId()).orElseGet(() -> {
            Pago nuevo = new Pago();
            nuevo.setOrdenId(request.ordenId());
            nuevo.setClienteId(clienteId != null ? clienteId : CLIENTE_ANONIMO);
            nuevo.setMonto(request.monto());
            nuevo.setMetodoPago(MetodoPago.YAPE_PLIN);
            nuevo.setEstado(EstadoPago.PENDIENTE);
            return nuevo;
        });

        if (pago.getEstado() == EstadoPago.APROBADO) {
            log.info("La orden {} ya cuenta con un pago aprobado previamente", request.ordenId());
            return PagoResponse.from(pago);
        }

        // T3: only a live order still waiting for its payment can be charged (not a terminal order,
        // not a ContraPago order in PENDIENTE_CONFIRMACION). The approved retry above stays idempotent.
        exigirPendienteDePago(request.ordenId(), orden);

        // Validación OTP: si el OTP es inválido (ej. "000000"), se rechaza
        if ("000000".equals(request.otp()) || request.otp().length() != 6) {
            pago.setEstado(EstadoPago.RECHAZADO);
            pago.setDetalle("Código de aprobación Yape inválido o expirado");
            pago = pagoRepository.save(pago);
            return PagoResponse.from(pago);
        }

        // Aprobación de pago Yape
        String ref = "MP-YAPE-" + java.util.UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        pago.setEstado(EstadoPago.APROBADO);
        pago.setReferenciaExterna(ref);
        pago.setDetalle("Cobro Yape OTP aprobado en tiempo real. Teléfono: " + request.telefono());
        pago = pagoRepository.save(pago);

        // Avanzar la orden DIRECTO a preparación en cocina
        notificarOrdenAsync(request.ordenId(), bearerToken);
        avisarAprobacionTrasConfirmar(pago.getOrdenId(), pago.getMonto(), pago.getMetodoPago());
        log.info("Pago Yape OTP exitoso para orden #{} — Pasando directo a cocina", request.ordenId());

        return PagoResponse.from(pago);
    }

    /**
     * Cobro obligatorio en efectivo verificado por el repartidor o cajero (ContraPago).
     * Registra el pago en efectivo y avanza la orden a ENTREGADO. El monto debe ser el total del
     * pedido y lo recibido no puede ser menor (S6); un pedido RECOJO exige su ticket POL-&lt;id&gt;,
     * que se reenvía a orders-service al marcarlo ENTREGADO (S7).
     */
    @Transactional
    public PagoResponse procesarCobroEfectivo(CobroEfectivoRequest request, Long operadorId, String bearerToken) {
        return procesarCobroEfectivo(request, operadorId, null, bearerToken);
    }

    /** Same as above; {@code repartidorId} is set when the collecting operator is a courier (S6 settlement). */
    @Transactional
    public PagoResponse procesarCobroEfectivo(CobroEfectivoRequest request, Long operadorId, Long repartidorId,
                                              String bearerToken) {
        log.info("Registrando cobro en efectivo para orden={}, monto=S/ {}, operadorId={}",
                request.ordenId(), request.monto(), operadorId);

        Pago pago = pagoRepository.buscarPorOrdenIdConBloqueo(request.ordenId()).orElseGet(() -> {
            Pago nuevo = new Pago();
            nuevo.setOrdenId(request.ordenId());
            nuevo.setClienteId(operadorId != null ? operadorId : CLIENTE_ANONIMO);
            nuevo.setMonto(request.monto());
            nuevo.setMetodoPago(MetodoPago.CONTRAENTREGA);
            return nuevo;
        });

        if (pago.getEstado() == EstadoPago.APROBADO) {
            log.info("El cobro en efectivo para la orden {} ya estaba registrado como APROBADO", request.ordenId());
            reenviarEntregaPendiente(request, bearerToken);
            return PagoResponse.from(pago);
        }

        // S6: cash can only be collected at the door / at pickup; fail closed if the order is unknown.
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(request.ordenId());
        if (!cobroEfectivoPermitido(orden)) {
            throw new IllegalStateException(
                    "No se puede cobrar en efectivo: la orden " + request.ordenId() + " es " + orden.tipo()
                            + " y está en estado " + orden.estado()
                            + " (delivery: EN_PUERTA/EN_CAMINO; recojo: LISTO/LISTO_PARA_ENTREGAR)");
        }

        // S6: the cash registered is exactly the order total, never what the operator types.
        if (orden.total() == null) {
            throw new OrdenesClient.OrdenNoDisponibleException(
                    "orders-service no informó el total de la orden " + request.ordenId(), null);
        }
        String total = orden.total().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        if (orden.total().compareTo(request.monto()) != 0) {
            throw new IllegalArgumentException("El monto cobrado debe ser el total del pedido (S/ " + total + ")");
        }
        if (request.montoRecibido() != null && request.montoRecibido().compareTo(orden.total()) < 0) {
            throw new IllegalArgumentException(
                    "El monto recibido no puede ser menor al total del pedido (S/ " + total + ")");
        }

        // S7: a pickup order is handed over only against its ticket POL-<id> (numeroCliente is not accepted).
        boolean esRecojo = "RECOJO".equals(orden.tipo());
        if (esRecojo) {
            validarTicketRecojo(request);
        }

        String detalle = "Cobro en efectivo verificado por operador #" + operadorId;
        if (request.montoRecibido() != null) {
            detalle += ". Recibido: S/ " + request.montoRecibido();
        }
        if (request.vueltoEntregado() != null) {
            detalle += ", Vuelto: S/ " + request.vueltoEntregado();
        }

        pago.setMetodoPago(MetodoPago.CONTRAENTREGA);
        pago.setEstado(EstadoPago.APROBADO);
        pago.setReferenciaExterna("EFECTIVO-ORD-" + request.ordenId());
        pago.setDetalle(detalle);
        pago.setVerificadoPor("OPERADOR_" + operadorId);
        pago.setVerificadoEn(LocalDateTime.now());
        pago.setRepartidorId(repartidorId);
        pago = pagoRepository.save(pago);

        notificarEntregado(request, esRecojo, bearerToken);
        log.info("Cobro en efectivo registrado para orden #{}. Orden actualizada a ENTREGADO", request.ordenId());

        return PagoResponse.from(pago);
    }

    /** S7: a pickup order is handed over only against its ticket POL-&lt;id&gt; (numeroCliente is not accepted). */
    private static void validarTicketRecojo(CobroEfectivoRequest request) {
        if (!normalizarTicket("POL-" + request.ordenId()).equals(normalizarTicket(request.codigoTicket()))) {
            throw new IllegalArgumentException(
                    "El código de ticket no corresponde al pedido #" + request.ordenId() + " (debe ser POL-"
                            + request.ordenId() + ")");
        }
    }

    /** Notifica a orders-service para completar la entrega (RECOJO lleva el ticket, S7). */
    private void notificarEntregado(CobroEfectivoRequest request, boolean esRecojo, String bearerToken) {
        if (esRecojo) {
            notificadorOrden.notificarEstado(request.ordenId(), "ENTREGADO", request.codigoTicket(), bearerToken);
        } else {
            notificarOrdenEstadoAsync(request.ordenId(), "ENTREGADO", bearerToken);
        }
    }

    /**
     * T3: the ENTREGADO notification is async, so a failed one would leave a paid order undelivered until
     * it rots into PEDIDO_FANTASMA. A retry of an already approved collection re-sends it while
     * orders-service still reports the order as not ENTREGADO. If the order cannot be read, the retry
     * keeps returning the approved pago (nothing would reach orders-service anyway).
     */
    private void reenviarEntregaPendiente(CobroEfectivoRequest request, String bearerToken) {
        OrdenesClient.OrdenInfo orden;
        try {
            orden = ordenesClient.obtener(request.ordenId());
        } catch (OrdenesClient.OrdenNoDisponibleException e) {
            log.warn("No se pudo leer la orden {} para reenviar ENTREGADO: {}", request.ordenId(), e.getMessage());
            return;
        }
        if (orden == null || "ENTREGADO".equals(orden.estado())) {
            return;
        }
        boolean esRecojo = "RECOJO".equals(orden.tipo());
        if (esRecojo) {
            validarTicketRecojo(request);
        }
        log.info("Reenviando ENTREGADO de la orden #{} (cobro ya aprobado, orden en {})",
                request.ordenId(), orden.estado());
        notificarEntregado(request, esRecojo, bearerToken);
    }

    /**
     * Cash a courier has collected and not yet handed in (S6): approved CONTRAENTREGA payments with his
     * {@code repartidor_id}, verified at or after {@code desde}, not claimed by any settlement.
     */
    @Transactional(readOnly = true)
    public EfectivoPendienteResponse efectivoPendiente(Long repartidorId, LocalDateTime desde) {
        List<Pago> pagos = pagoRepository.efectivoPendienteDeRepartidor(
                repartidorId, desde != null ? desde : LocalDateTime.of(2000, 1, 1, 0, 0));
        BigDecimal total = pagos.stream().map(Pago::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EfectivoPendienteResponse(repartidorId, total, pagos.size(),
                pagos.stream()
                        .map(p -> new EfectivoPendienteResponse.Item(p.getId(), p.getOrdenId(), p.getMonto(), p.getVerificadoEn()))
                        .toList());
    }

    /**
     * Marks cash payments as handed in under a settlement. Idempotent for the same settlement; a payment
     * already claimed by another settlement is rejected (409) and nothing is changed.
     */
    @Transactional
    public int liquidarEfectivo(List<Long> pagoIds, Long liquidacionId) {
        List<Pago> pagos = pagoRepository.findAllById(pagoIds);
        if (pagos.size() != pagoIds.stream().distinct().count()) {
            throw new NoSuchElementException("Alguno de los pagos a liquidar no existe");
        }
        for (Pago p : pagos) {
            if (p.getMetodoPago() != MetodoPago.CONTRAENTREGA || p.getEstado() != EstadoPago.APROBADO) {
                throw new IllegalStateException("El pago " + p.getId() + " no es un cobro en efectivo aprobado");
            }
            if (p.getLiquidacionId() != null && !p.getLiquidacionId().equals(liquidacionId)) {
                throw new IllegalStateException("El pago " + p.getId() + " ya fue liquidado en la liquidación #"
                        + p.getLiquidacionId());
            }
        }
        pagos.forEach(p -> p.setLiquidacionId(liquidacionId));
        pagoRepository.saveAll(pagos);
        return pagos.size();
    }
}
