package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.CobroEfectivoRequest;
import com.mercadopago.resources.paymentmethod.PaymentMethod;
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
import com.sistema.polleria.payments.gateway.ConsultaPagoMercadoPago;
import com.sistema.polleria.payments.gateway.GatewayResult;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import com.sistema.polleria.payments.gateway.PaymentGateway;
import com.sistema.polleria.payments.gateway.PaymentGatewayService;
import com.sistema.polleria.payments.repository.PagoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.function.Supplier;

@Slf4j
@Service
public class PagoService {

    private final PagoRepository pagoRepository;
    private final PaymentGatewayService paymentGatewayService;
    private final MercadoPagoGateway mercadoPagoGateway;
    private final NotificadorOrden notificadorOrden;
    private final WhatsappNotificationClient whatsappNotificationClient;
    private final OrdenesClient ordenesClient;
    private final AlmacenComprobantes almacenComprobantes;
    private final ConsultaPagoMercadoPago consultaPagoMercadoPago;
    private final FinanceComprobanteClient financeComprobanteClient;
    private final TransactionTemplate transactionTemplate;

    @Value("${payments.yape-otp-mock.enabled:false}")
    private boolean yapeOtpMockEnabled = true;

    public PagoService(
            PagoRepository pagoRepository,
            PaymentGatewayService paymentGatewayService,
            MercadoPagoGateway mercadoPagoGateway,
            NotificadorOrden notificadorOrden,
            WhatsappNotificationClient whatsappNotificationClient,
            OrdenesClient ordenesClient,
            AlmacenComprobantes almacenComprobantes,
            ConsultaPagoMercadoPago consultaPagoMercadoPago) {
        this(pagoRepository, paymentGatewayService, mercadoPagoGateway, notificadorOrden,
                whatsappNotificationClient, ordenesClient, almacenComprobantes, consultaPagoMercadoPago, null, null);
    }

    public PagoService(
            PagoRepository pagoRepository,
            PaymentGatewayService paymentGatewayService,
            MercadoPagoGateway mercadoPagoGateway,
            NotificadorOrden notificadorOrden,
            WhatsappNotificationClient whatsappNotificationClient,
            OrdenesClient ordenesClient,
            AlmacenComprobantes almacenComprobantes,
            ConsultaPagoMercadoPago consultaPagoMercadoPago,
            FinanceComprobanteClient financeComprobanteClient) {
        this(pagoRepository, paymentGatewayService, mercadoPagoGateway, notificadorOrden,
                whatsappNotificationClient, ordenesClient, almacenComprobantes, consultaPagoMercadoPago,
                financeComprobanteClient, null);
    }

    @Autowired
    public PagoService(
            PagoRepository pagoRepository,
            PaymentGatewayService paymentGatewayService,
            MercadoPagoGateway mercadoPagoGateway,
            NotificadorOrden notificadorOrden,
            WhatsappNotificationClient whatsappNotificationClient,
            OrdenesClient ordenesClient,
            AlmacenComprobantes almacenComprobantes,
            ConsultaPagoMercadoPago consultaPagoMercadoPago,
            @Autowired(required = false) FinanceComprobanteClient financeComprobanteClient,
            @Autowired(required = false) PlatformTransactionManager transactionManager) {
        this.pagoRepository = pagoRepository;
        this.paymentGatewayService = paymentGatewayService;
        this.mercadoPagoGateway = mercadoPagoGateway;
        this.notificadorOrden = notificadorOrden;
        this.whatsappNotificationClient = whatsappNotificationClient;
        this.ordenesClient = ordenesClient;
        this.almacenComprobantes = almacenComprobantes;
        this.consultaPagoMercadoPago = consultaPagoMercadoPago;
        this.financeComprobanteClient = financeComprobanteClient;
        this.transactionTemplate = transactionManager != null ? new TransactionTemplate(transactionManager) : null;
    }

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

        Pago pago = pagoRepository.findByOrdenId(request.ordenId()).orElseGet(Pago::new);
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
        return registrarComprobante(request, orden.clienteId() != null ? orden.clienteId() : CLIENTE_ANONIMO);
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

        // CON-17: persistir primero el pago y luego avisar a orders-service; si orders falla,
        // Spring revierte saveAndFlush para mantener ambos servicios consistentes.
        ordenesClient.marcarComprobante(request.ordenId(), true);

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
     * aquí solo se aplica la decisión. Aprobar exige una captura adjunta (HTTP 400); no hay ventana
     * por antigüedad del pedido: la captura en revisión detiene su expiración (S6). Aprobar también exige que orders-service informe la orden todavía
     * en {@code PENDIENTE_PAGO} (S2, HTTP 409; si no responde, falla cerrado).
     *
     * <p><b>Aprobar</b>: el pago pasa a {@link EstadoPago#APROBADO} y el pedido avanza con el
     * **mismo mecanismo** que usa el pago aprobado de Mercado Pago
     * ({@code notificarOrdenAsync → NotificadorOrden.notificarPagoAprobado}, que mueve la orden a
     * {@code RECIBIDO}, la cola de cocina). No se inventa otro camino.
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
    public PagoResponse verificar(Long id, VerificarPagoRequest request, String adminEmail, String bearerToken) {
        // CON-03: leer snapshot y consultar orders-service fuera del bloqueo FOR UPDATE cuando aprueba,
        // ejecutando la fase bloqueada en su propia transacción para no contaminar la caché L1 de Hibernate.
        OrdenesClient.OrdenInfo ordenPrevia = null;
        if (Boolean.TRUE.equals(request.aprobado())) {
            Pago snapshot = pagoRepository.findById(id)
                    .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));
            if (snapshot.getEstado() != EstadoPago.PENDIENTE_VERIFICACION) {
                throw new IllegalStateException(
                        "Solo se puede verificar un comprobante PENDIENTE_VERIFICACION. Estado actual: "
                                + snapshot.getEstado());
            }
            if (snapshot.getComprobanteClave() == null || snapshot.getComprobanteClave().isBlank()) {
                throw new IllegalArgumentException(
                        "No se puede confirmar el pago: el cliente aún no adjuntó la captura del comprobante");
            }
            ordenPrevia = obtenerOrden(snapshot.getOrdenId());
            if (!"PENDIENTE_PAGO".equals(ordenPrevia.estado())) {
                throw new IllegalStateException("El pedido #" + snapshot.getOrdenId()
                        + " ya no está pendiente de pago (estado " + ordenPrevia.estado()
                        + "): no se puede aprobar el comprobante");
            }
        }
        final OrdenesClient.OrdenInfo ordenValidada = ordenPrevia;
        return ejecutarEnTransaccion(() -> verificarEnTx(id, request, adminEmail, bearerToken, ordenValidada));
    }

    private PagoResponse verificarEnTx(
            Long id,
            VerificarPagoRequest request,
            String adminEmail,
            String bearerToken,
            OrdenesClient.OrdenInfo ordenPrevia) {
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
            // S6: the order gets a fresh payment window to resend the capture (fail closed).
            ordenesClient.marcarComprobante(pago.getOrdenId(), false);
            avisarRechazoTrasConfirmar(pago.getOrdenId(), motivo);
            log.info("Comprobante rechazado — pago id={} orden={} admin={}",
                    pago.getId(), pago.getOrdenId(), adminEmail);
            return PagoResponse.from(pago);
        }

        if (pago.getComprobanteClave() == null || pago.getComprobanteClave().isBlank()) {
            throw new IllegalArgumentException(
                    "No se puede confirmar el pago: el cliente aún no adjuntó la captura del comprobante");
        }
        OrdenesClient.OrdenInfo orden = ordenPrevia != null ? ordenPrevia : obtenerOrden(pago.getOrdenId());
        if (!"PENDIENTE_PAGO".equals(orden.estado())) {
            throw new IllegalStateException("El pedido #" + pago.getOrdenId() + " ya no está pendiente de pago "
                    + "(estado " + orden.estado() + "): no se puede aprobar el comprobante");
        }

        pago.setEstado(EstadoPago.APROBADO);
        pago.setMotivoRechazo(null);
        pago.setVerificadoPor(adminEmail);
        pago.setVerificadoEn(LocalDateTime.now());
        pago.setDetalle("Comprobante de Yape verificado por el administrador");
        pago = pagoRepository.save(pago);

        final Pago pagoConfirmado = pago;
        ejecutarTrasCommit(() -> {
            notificarOrdenAsync(pagoConfirmado.getOrdenId(), bearerToken);
            encolarAvisoAprobacion(pagoConfirmado.getOrdenId(), pagoConfirmado.getMonto(), pagoConfirmado.getMetodoPago());
            emitirBoletaDigital(pagoConfirmado);
        });
        log.info("Comprobante aprobado — pago id={} orden={} admin={}",
                pago.getId(), pago.getOrdenId(), adminEmail);
        return PagoResponse.from(pago);
    }

    private <T> T ejecutarEnTransaccion(Supplier<T> accion) {
        if (transactionTemplate == null) {
            return accion.get();
        }
        return transactionTemplate.execute(status -> accion.get());
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

    /** Lists pagos newest first, optionally filtered by estado, fecha (America/Lima) and max limit. */
    public List<PagoResponse> todos(EstadoPago estado) {
        return todos(estado, null, null);
    }

    public List<PagoResponse> todos(EstadoPago estado, LocalDate fecha, Integer limit) {
        List<Pago> pagos;
        if (fecha != null) {
            LocalDateTime desde = fecha.atStartOfDay();
            LocalDateTime hasta = fecha.plusDays(1).atStartOfDay();
            pagos = estado == null
                    ? pagoRepository.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDesc(desde, hasta)
                    : pagoRepository.findByEstadoAndCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDesc(estado, desde, hasta);
        } else if (limit != null && limit > 0) {
            PageRequest pageable = PageRequest.of(0, Math.min(limit, 500));
            pagos = estado == null
                    ? pagoRepository.findAllByOrderByCreadoEnDesc(pageable)
                    : pagoRepository.findByEstadoOrderByCreadoEnDesc(estado, pageable);
        } else {
            pagos = estado == null
                    ? pagoRepository.findAllByOrderByCreadoEnDesc()
                    : pagoRepository.findByEstadoOrderByCreadoEnDesc(estado);
        }
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
        // devuelve el estado actual sin reprocesar el cobro, sin reenviar WhatsApp ni reemitir
        // comprobante; únicamente se reenvía la notificación a orders-service si la orden
        // todavía permanece en PENDIENTE_PAGO porque la notificación previa falló (D2.3).
        if (pago.getEstado() == EstadoPago.APROBADO) {
            reenviarNotificacionSiOrdenSiguePendiente(id, pago.getOrdenId(), bearerToken);
            return PagoResponse.from(pago);
        }

        // DIN-07: confirmar solo avanza desde PENDIENTE (nunca reabre RECHAZADO/REEMBOLSADO/CANCELADO).
        if (pago.getEstado() != EstadoPago.PENDIENTE) {
            throw new IllegalStateException(
                    "Solo se puede confirmar un pago PENDIENTE. Estado actual: " + pago.getEstado());
        }

        if (req.metodoPago() != null) {
            pago.setMetodoPago(req.metodoPago());
        }
        if (req.mpPaymentId() != null && !req.mpPaymentId().isBlank()) {
            pago.setMpPaymentId(req.mpPaymentId().trim());
        }
        pago.setReferenciaExterna(req.referenciaExterna());

        OrdenesClient.OrdenInfo orden = leerOrdenSilencioso(pago.getOrdenId());
        if (orden != null && ("CANCELADO".equals(orden.estado()) || "PEDIDO_FANTASMA".equals(orden.estado()))) {
            boolean esMp = (req.mpPaymentId() != null && !req.mpPaymentId().isBlank())
                    || (mercadoPagoGateway != null && mercadoPagoGateway.esPagoMercadoPago(pago));
            if (esMp && mercadoPagoGateway != null) {
                pago.setMontoReembolsado(pago.getMonto());
                pago.setEstado(EstadoPago.REEMBOLSADO);
                pago.setDetalle("Reembolso automático: pago recibido con orden en estado " + orden.estado());
                mercadoPagoGateway.procesarReembolso(pago, pago.getMonto());
                pago = pagoRepository.save(pago);
                log.warn("DIN-01/CON-04: Pago id={} para orden {} ({}) reembolsado automáticamente",
                        id, pago.getOrdenId(), orden.estado());
                return PagoResponse.from(pago);
            }
            throw new IllegalStateException(
                    "No se puede confirmar el pago: la orden #" + pago.getOrdenId() + " está " + orden.estado());
        }

        pago.setEstado(EstadoPago.APROBADO);
        pago.setDetalle(req.detalle());
        pago = pagoRepository.save(pago);

        final Pago pagoConfirmado = pago;
        ejecutarTrasCommit(() -> {
            notificarOrdenAsync(pagoConfirmado.getOrdenId(), bearerToken);
            encolarAvisoAprobacion(pagoConfirmado.getOrdenId(), pagoConfirmado.getMonto(), pagoConfirmado.getMetodoPago());
            emitirBoletaDigital(pagoConfirmado);
        });
        log.info("Pago confirmado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse cancelar(Long id) {
        Pago pago = pagoRepository.buscarConBloqueo(id)
                .or(() -> pagoRepository.findById(id))
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));
        if (pago.getEstado() == EstadoPago.CANCELADO) {
            return PagoResponse.from(pago);
        }
        // DIN-02: nunca cancelar comprobantes en verificación, aprobados ni reembolsados.
        if (pago.getEstado() != EstadoPago.PENDIENTE && pago.getEstado() != EstadoPago.RECHAZADO) {
            throw new IllegalStateException(
                    "No se puede cancelar un pago en estado " + pago.getEstado());
        }
        pago.setEstado(EstadoPago.CANCELADO);
        pago.setDetalle("Pago cancelado");
        pago = pagoRepository.save(pago);
        final Long ordenId = pago.getOrdenId();
        ejecutarTrasCommit(() -> notificarOrdenEstadoAsync(ordenId, "CANCELADO", ""));
        log.info("Pago cancelado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsar(Long id, BigDecimal monto, String motivo) {
        return reembolsar(id, monto, motivo, null);
    }

    @Transactional
    public PagoResponse reembolsar(Long id, BigDecimal monto, String motivo, String idempotencyKey) {
        Pago pago = pagoRepository.buscarConBloqueo(id)
                .or(() -> pagoRepository.findById(id))
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));

        String claveLimpia = (idempotencyKey != null && !idempotencyKey.isBlank()) ? idempotencyKey.trim() : null;
        if (claveLimpia != null) {
            if (claveLimpia.equals(pago.getReembolsoIdempotencyKey())
                    || pagoRepository.findByReembolsoIdempotencyKey(claveLimpia).isPresent()) {
                log.info("Reembolso idempotente (Idempotency-Key={}) para pago id={}", claveLimpia, id);
                return PagoResponse.from(pago);
            }
        }

        // D4.7: solo se puede reembolsar desde APROBADO o REEMBOLSADO_PARCIAL
        if (pago.getEstado() != EstadoPago.APROBADO && pago.getEstado() != EstadoPago.REEMBOLSADO_PARCIAL) {
            if (claveLimpia == null && monto == null && pago.getEstado() == EstadoPago.REEMBOLSADO) {
                return PagoResponse.from(pago);
            }
            throw new IllegalStateException("Solo se pueden reembolsar pagos APROBADOS. Estado actual: " + pago.getEstado());
        }

        BigDecimal yaReembolsado = pago.getMontoReembolsadoSeguro();
        BigDecimal disponible = pago.getMonto().subtract(yaReembolsado);
        BigDecimal efectivo = monto != null ? monto : disponible;
        if (efectivo.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("El monto a reembolsar debe ser positivo");
        }
        if (efectivo.compareTo(disponible) > 0) {
            throw new IllegalStateException("El reembolso solicitado (S/ " + efectivo
                    + ") supera el saldo disponible por reembolsar (S/ " + disponible + ")");
        }

        BigDecimal nuevoAcumulado = yaReembolsado.add(efectivo);
        boolean completo = nuevoAcumulado.compareTo(pago.getMonto()) >= 0;

        if (claveLimpia != null) {
            pago.setReembolsoIdempotencyKey(claveLimpia);
        }
        pago.setMontoReembolsado(nuevoAcumulado);
        pago.setEstado(completo ? EstadoPago.REEMBOLSADO : EstadoPago.REEMBOLSADO_PARCIAL);
        pago.setDetalle((completo ? "Reembolso" : "Reembolso parcial")
                + " procesado por S/ " + efectivo + ". Motivo: " + (motivo != null ? motivo : "Reclamo procedente"));

        // Persistir bajo bloqueo antes de invocar a la pasarela (CON-01); si MP falla, revierte la tx.
        pago = pagoRepository.save(pago);
        if (mercadoPagoGateway != null && mercadoPagoGateway.esPagoMercadoPago(pago)) {
            mercadoPagoGateway.procesarReembolso(pago, efectivo);
        }
        log.info("Pago reembolsado — id={} orden={} monto={} acumulado={} estado={}",
                pago.getId(), pago.getOrdenId(), efectivo, nuevoAcumulado, pago.getEstado());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse reembolsarPorOrden(Long ordenId, BigDecimal monto, String motivo) {
        return reembolsarPorOrden(ordenId, monto, motivo, null);
    }

    @Transactional
    public PagoResponse reembolsarPorOrden(Long ordenId, BigDecimal monto, String motivo, String idempotencyKey) {
        Pago pago = pagoRepository.buscarPorOrdenIdConBloqueo(ordenId)
                .or(() -> pagoRepository.findByOrdenId(ordenId))
                .orElseThrow(() -> new NoSuchElementException("No existe pago asociado a la orden: " + ordenId));
        return reembolsar(pago.getId(), monto, motivo, idempotencyKey);
    }

    /**
     * Aplica un estado informado por la pasarela (webhook) tomando el bloqueo pesimista del pago.
     * Desde APROBADO solo se permite pasar a REEMBOLSADO o REEMBOLSADO_PARCIAL (DIN-06/DIN-07).
     */
    @Transactional
    public PagoResponse actualizarEstadoDesdePasarela(Long pagoId, EstadoPago nuevoEstado, String detalle) {
        Pago pago = pagoRepository.buscarConBloqueo(pagoId)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + pagoId));

        EstadoPago actual = pago.getEstado();
        if (actual == nuevoEstado) {
            return PagoResponse.from(pago);
        }
        if (actual == EstadoPago.APROBADO
                && nuevoEstado != EstadoPago.REEMBOLSADO && nuevoEstado != EstadoPago.REEMBOLSADO_PARCIAL) {
            log.info("DIN-06: Se ignora transición {} → {} en pago id={}", actual, nuevoEstado, pagoId);
            return PagoResponse.from(pago);
        }
        if (actual == EstadoPago.REEMBOLSADO_PARCIAL && nuevoEstado != EstadoPago.REEMBOLSADO) {
            log.info("DIN-07: Se ignora transición {} → {} en pago id={}", actual, nuevoEstado, pagoId);
            return PagoResponse.from(pago);
        }
        if (actual == EstadoPago.REEMBOLSADO || actual == EstadoPago.CANCELADO) {
            log.info("Estado terminal {} protegido en pago id={}; se ignora {}", actual, pagoId, nuevoEstado);
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

    private void ejecutarTrasCommit(Runnable accion) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            try {
                accion.run();
            } catch (Exception e) {
                log.warn("Error al ejecutar acción post-pago: {}", e.getMessage());
            }
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    accion.run();
                } catch (Exception e) {
                    log.warn("Error en callback afterCommit de pagos: {}", e.getMessage());
                }
            }
        });
    }

    private void emitirBoletaDigital(Pago pago) {
        if (financeComprobanteClient != null) {
            financeComprobanteClient.emitirBoletaDigitalAsync(pago);
        }
    }

    private OrdenesClient.OrdenInfo leerOrdenSilencioso(Long ordenId) {
        if (ordenesClient == null) {
            return null;
        }
        try {
            return ordenesClient.obtener(ordenId);
        } catch (Exception e) {
            log.warn("No se pudo verificar estado de orden {} durante confirmación: {}", ordenId, e.getMessage());
            return null;
        }
    }

    private void reenviarNotificacionSiOrdenSiguePendiente(Long pagoId, Long ordenId, String bearerToken) {
        OrdenesClient.OrdenInfo orden = leerOrdenSilencioso(ordenId);
        if (orden != null && "PENDIENTE_PAGO".equals(orden.estado())) {
            log.info("Pago id={} ya estaba APROBADO pero la orden #{} sigue en PENDIENTE_PAGO: reenviando notificación a orders-service",
                    pagoId, ordenId);
            final Long idOrden = ordenId;
            ejecutarTrasCommit(() -> notificarOrdenAsync(idOrden, bearerToken));
            return;
        }
        log.info("Pago id={} ya estaba APROBADO: confirmación idempotente sin notificaciones", pagoId);
    }

    private void validarTransicion(EstadoPago actual, EstadoPago nuevo) {
        if (actual == EstadoPago.APROBADO || actual == EstadoPago.CANCELADO) {
            throw new IllegalStateException(
                "No se puede cambiar un pago en estado " + actual + " a " + nuevo);
        }
    }

    /**
     * Notifica a orders-service que el pago fue aprobado para avanzar
     * automáticamente el estado del pedido a RECIBIDO, la cola de cocina (RF21).
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

    /**
     * Consulta los medios de pago disponibles configurados en la cuenta de Mercado Pago.
     */
    public List<PaymentMethod> listarMediosDePagoMercadoPago() {
        return mercadoPagoGateway.listarMediosDePago();
    }

    /**
     * Procesa la redirección de retorno desde Mercado Pago (success_url).
     * Confirma la orden si el estado fue aprobado por Mercado Pago.
     */
    @Transactional
    public PagoResponse procesarRetornoMercadoPago(String paymentId, String status, String externalReference) {
        log.info("Procesando retorno GET de Mercado Pago: paymentId={}, status={}, externalReference={}",
                paymentId, status, externalReference);

        if (externalReference == null || externalReference.isBlank()) {
            throw new IllegalArgumentException("external_reference es obligatorio en el retorno");
        }

        Long pagoId;
        try {
            pagoId = Long.parseLong(externalReference.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("external_reference inválido: " + externalReference);
        }

        Pago pago = pagoRepository.findById(pagoId)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + pagoId));

        if (pago.getEstado() == EstadoPago.APROBADO) {
            return PagoResponse.from(pago);
        }

        // The URL is public and can be typed by anyone: its status is ignored. Only the state that
        // Mercado Pago reports for this payment id, for this pago and its amount, changes anything.
        if (paymentId == null || !paymentId.matches("\\d+")) {
            log.warn("Retorno de Mercado Pago sin payment_id verificable para pago #{}", pagoId);
            return PagoResponse.from(pago);
        }
        var verificado = consultaPagoMercadoPago.consultar(Long.parseLong(paymentId)).orElse(null);
        if (verificado == null
                || !String.valueOf(pagoId).equals(verificado.referenciaExterna())
                || verificado.monto() == null || pago.getMonto() == null
                || verificado.monto().compareTo(pago.getMonto()) != 0) {
            log.warn("Retorno de Mercado Pago no verificado para pago #{} (payment_id={}, estado URL={})",
                    pagoId, paymentId, status);
            return PagoResponse.from(pago);
        }

        if (verificado.aprobado()) {
            String refExterna = "MP-" + paymentId;
            return confirmar(pagoId, new ConfirmarPagoRequest(refExterna,
                    "Pago aprobado por Mercado Pago (retorno verificado: " + refExterna + ")", null, paymentId), "");
        }
        if (verificado.rechazado()) {
            actualizarEstadoDesdePasarela(pagoId, EstadoPago.RECHAZADO, "Pago rechazado en pasarela Mercado Pago");
        }
        return PagoResponse.from(pago);
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
        if (!yapeOtpMockEnabled) {
            throw new IllegalStateException("El pago simulado Yape OTP está deshabilitado en este entorno");
        }
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

        final Pago pagoConfirmado = pago;
        ejecutarTrasCommit(() -> {
            notificarOrdenAsync(request.ordenId(), bearerToken);
            encolarAvisoAprobacion(pagoConfirmado.getOrdenId(), pagoConfirmado.getMonto(), pagoConfirmado.getMetodoPago());
            emitirBoletaDigital(pagoConfirmado);
        });
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
        // DIN-14: si el cobro lo ejecuta un repartidor en delivery, debe ser el asignado a la orden.
        if (repartidorId != null && orden.repartidorId() != null && !orden.repartidorId().equals(repartidorId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Solo el repartidor asignado a la orden #" + request.ordenId() + " puede cobrar en efectivo");
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

        ejecutarTrasCommit(() -> notificarEntregado(request, esRecojo, bearerToken));
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
        // DIN-04: mantener los cobros aunque hayan tenido reembolso parcial/total y restar lo reembolsado.
        List<EfectivoPendienteResponse.Item> items = pagos.stream()
                .map(p -> new EfectivoPendienteResponse.Item(
                        p.getId(),
                        p.getOrdenId(),
                        p.getMonto().subtract(p.getMontoReembolsadoSeguro()),
                        p.getVerificadoEn()))
                .filter(item -> item.monto().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        BigDecimal total = items.stream()
                .map(EfectivoPendienteResponse.Item::monto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new EfectivoPendienteResponse(repartidorId, total, items.size(), items);
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
            boolean estadoLiquidable = p.getEstado() == EstadoPago.APROBADO
                    || p.getEstado() == EstadoPago.REEMBOLSADO_PARCIAL;
            if (p.getMetodoPago() != MetodoPago.CONTRAENTREGA || !estadoLiquidable) {
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
