package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrdenService {

    private final OrdenRepository ordenRepository;
    private final ProductoService productoService;
    private final MesaService mesaService;
    private final NotificationService notificationService;
    private final SalonEventPublisher salonEventPublisher;
    private final NumeroPedidoService numeroPedidoService;
    private final SancionDispatcherService sancionDispatcherService;

    private static final List<OrdenEstado> ESTADOS_INICIALES_PERMITIDOS = List.of(
            OrdenEstado.RECIBIDO,
            OrdenEstado.PENDIENTE_PAGO,
            OrdenEstado.PENDIENTE_CONFIRMACION
    );

    private static final List<OrdenEstado> ESTADOS_TERMINALES = List.of(
            OrdenEstado.ENTREGADO,
            OrdenEstado.CANCELADO,
            OrdenEstado.PEDIDO_FANTASMA
    );

    /** Trusted creation (staff, internal callers): equivalent to {@code checkoutPublico = false}. */
    @Transactional
    public OrdenResponse crear(CrearOrdenRequest request, Long usuarioId) {
        return crear(request, usuarioId, false);
    }

    /**
     * @param checkoutPublico true when the caller is neither staff nor an internal service. A public
     *                        DELIVERY/RECOJO order cannot open in RECIBIDO: without an explicit state
     *                        it waits for its payment (PENDIENTE_PAGO), so an abandoned payment
     *                        expires and the kitchen never sees it before it is paid.
     */
    @Transactional
    public OrdenResponse crear(CrearOrdenRequest request, Long usuarioId, boolean checkoutPublico) {
        validarRequest(request);
        OrdenEstado estadoInicial = resolverEstadoInicial(request, checkoutPublico);

        // Validación de sanciones en backend para ContraPago (Anti-Bypass de cliente)
        if (request.getEstadoInicial() == OrdenEstado.PENDIENTE_CONFIRMACION) {
            if (sancionDispatcherService != null && sancionDispatcherService.tieneSancionActiva(
                    request.getTelefonoCliente(), null, request.getIpOrigen())) {
                throw new ConflictoDeEstadoException(
                        "El cliente con teléfono " + request.getTelefonoCliente()
                        + " registra una sanción por Pedido Fantasma y no puede elegir ContraPago en efectivo.");
            }
        }

        Orden orden = Orden.builder()
                .tipo(request.getTipo())
                .canalOrigen(resolverCanalOrigen(request))
                .estado(estadoInicial)
                .clienteId(usuarioId)
                // En salón el usuario autenticado es el mozo que toma la comanda: se registra
                // también en mozoId para que la ventana del mozo y el admin lo muestren.
                .mozoId(usuarioId != null && usuarioId > 0 && request.getTipo() == OrdenTipo.SALON
                        ? usuarioId : null)
                .direccionEntrega(request.getDireccionEntrega())
                .referencia(request.getReferencia())
                .nombreCliente(request.getNombreCliente())
                .telefonoCliente(request.getTelefonoCliente())
                .observaciones(request.getObservaciones())
                .montoPagaCon(request.getMontoPagaCon())
                .ipOrigen(request.getIpOrigen())
                .requiereCobroEfectivo(request.getEstadoInicial() == OrdenEstado.PENDIENTE_CONFIRMACION)
                .build();

        if (request.getTipo() == OrdenTipo.SALON && request.getMesaId() != null) {
            // Bloqueo pesimista: sin él, dos mozos podían abrir una comanda en la misma mesa
            // a la vez porque ambos veían la mesa sin comanda activa.
            Mesa mesa = mesaService.buscarOFallarConBloqueo(request.getMesaId());
            if (!Boolean.TRUE.equals(mesa.getActivo())) {
                throw new ConflictoDeEstadoException(
                        "La mesa " + mesa.getNumero() + " está dada de baja y no puede recibir comandas. "
                        + "Reactívala en el panel para volver a usarla.");
            }
            // Una mesa en limpieza no está operativa: primero se termina la limpieza.
            if (mesa.getEstado() == MesaEstado.EN_LIMPIEZA) {
                throw new ConflictoDeEstadoException(
                        "La mesa " + mesa.getNumero() + " está en limpieza. "
                        + "Terminá la limpieza antes de abrir una comanda.");
            }
            List<Orden> comandasActivas = ordenRepository.findByMesaIdAndEstadoNotIn(mesa.getId(), ESTADOS_TERMINALES);
            if (!comandasActivas.isEmpty()) {
                throw new ConflictoDeEstadoException(
                        "La mesa " + mesa.getNumero() + " ya tiene una comanda activa. "
                        + "Agrega los productos a esa comanda en lugar de abrir una nueva.");
            }
            orden.setMesa(mesa);
            mesa.setEstado(MesaEstado.OCUPADA);
        }

        // Construir items
        List<OrdenItem> items = request.getItems().stream()
                .map(itemReq -> construirItem(orden, itemReq))
                .toList();

        orden.getItems().addAll(items);
        orden.recalcularTotal();
        // ContraPago: the courier/cashier must be able to give change. An amount below the total
        // (delivery fee included) would leave the order unpayable at the door.
        if (estadoInicial == OrdenEstado.PENDIENTE_CONFIRMACION && orden.getMontoPagaCon() != null
                && orden.getMontoPagaCon().compareTo(orden.getTotal()) < 0) {
            throw new IllegalArgumentException("El monto con el que pagas (S/ "
                    + soles(orden.getMontoPagaCon()) + ") no cubre el total del pedido (S/ "
                    + soles(orden.getTotal()) + ")");
        }
        if (orden.getMontoPagaCon() != null && orden.getMontoPagaCon().compareTo(orden.getTotal()) > 0) {
            orden.setVueltoEstimado(orden.getMontoPagaCon().subtract(orden.getTotal()));
        }
        numeroPedidoService.asignar(orden);

        ordenRepository.save(orden);
        log.info("Orden #{} creada — tipo: {}, total: S/.{}, N.° {} del cliente",
                orden.getId(), orden.getTipo(), orden.getTotal(), orden.getNumeroCliente());
        salonEventPublisher.notificarNuevaComanda(orden);
        if (orden.getMesa() != null) {
            salonEventPublisher.notificarMesaActualizada(mesaService.mapearMesaConOrdenActiva(orden.getMesa()));
        }
        return OrdenResponse.from(orden);
    }

    /**
     * Segunda ronda sobre una comanda de salón: los platos nuevos se suman a la MISMA orden
     * (no se abre otra comanda para la mesa), se recalcula el total y se vuelve a publicar el
     * evento de cocina. Una comanda {@code LISTO} regresa a {@code EN_PREPARACION} porque la
     * ronda nueva tiene que pasar por cocina.
     */
    @Transactional
    public OrdenResponse agregarItems(Long id, List<OrdenItemRequest> itemsReq, Long usuarioId) {
        Orden orden = buscarOFallarConBloqueo(id);

        if (orden.getTipo() != OrdenTipo.SALON) {
            throw new IllegalArgumentException(
                    "Solo las comandas de salón aceptan productos adicionales; el pedido #" + id
                    + " es de tipo " + orden.getTipo() + ".");
        }

        if (ESTADOS_TERMINALES.contains(orden.getEstado())) {
            throw new ConflictoDeEstadoException(
                    "La comanda #" + id + " ya está " + orden.getEstado()
                    + " y no admite productos nuevos.");
        }

        List<OrdenItem> nuevos = itemsReq.stream()
                .map(itemReq -> construirItem(orden, itemReq))
                .toList();

        orden.getItems().addAll(nuevos);
        orden.recalcularTotal();

        if (orden.getEstado().esListo()) {
            orden.setEstado(OrdenEstado.EN_PREPARACION);
        }

        ordenRepository.save(orden);
        log.info("Comanda #{} ampliada con {} ítem(s) por usuario {} — nuevo total: S/.{}",
                id, nuevos.size(), usuarioId, orden.getTotal());
        salonEventPublisher.notificarNuevaComanda(orden);
        if (orden.getMesa() != null) {
            salonEventPublisher.notificarMesaActualizada(mesaService.mapearMesaConOrdenActiva(orden.getMesa()));
        }
        return OrdenResponse.from(orden);
    }

    /**
     * Resuelve el canal del pedido (S1, decisión de L5). Si el request lo trae explícito se
     * respeta; si no, se deriva del tipo: {@code SALON} para las comandas de salón y {@code WEB}
     * para todo lo demás. Ese default es lo que mantiene compatible al checkout web actual, que
     * no manda el campo, y quien toma pedidos por WhatsApp manda {@code WHATSAPP} explícito.
     */
    private CanalOrigen resolverCanalOrigen(CrearOrdenRequest request) {
        if (request.getCanalOrigen() != null) {
            return request.getCanalOrigen();
        }
        return request.getTipo() == OrdenTipo.SALON ? CanalOrigen.SALON : CanalOrigen.WEB;
    }

    private OrdenEstado resolverEstadoInicial(CrearOrdenRequest request, boolean checkoutPublico) {
        OrdenEstado pedido = request.getEstadoInicial();
        if (!checkoutPublico) {
            return pedido != null ? pedido : OrdenEstado.RECIBIDO;
        }
        if (pedido == OrdenEstado.RECIBIDO) {
            throw new IllegalArgumentException("El checkout público no puede abrir un pedido en RECIBIDO: "
                    + "use PENDIENTE_PAGO o PENDIENTE_CONFIRMACION");
        }
        if (pedido == null && (request.getTipo() == OrdenTipo.DELIVERY || request.getTipo() == OrdenTipo.RECOJO)) {
            return OrdenEstado.PENDIENTE_PAGO;
        }
        return pedido != null ? pedido : OrdenEstado.RECIBIDO;
    }

    private static String soles(java.math.BigDecimal monto) {
        return monto.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    /** Ítem de comanda validando que el producto exista y esté disponible. */
    private OrdenItem construirItem(Orden orden, OrdenItemRequest itemReq) {
        Producto producto = productoService.buscarOFallar(itemReq.getProductoId());
        if (!producto.isDisponible()) {
            throw new IllegalArgumentException("El producto '" + producto.getNombre() + "' está agotado");
        }
        return OrdenItem.builder()
                .orden(orden)
                .producto(producto)
                .cantidad(itemReq.getCantidad())
                .precioUnitario(producto.getPrecio())
                .subtotal(producto.getPrecio().multiply(java.math.BigDecimal.valueOf(itemReq.getCantidad())))
                .notas(itemReq.getNotas())
                .build();
    }

    // Transaccional a propósito: `Orden.items` es LAZY y OrdenResponse lo recorre. Fuera de una
    // transacción esto revienta con LazyInitializationException en cuanto el despliegue apaga
    // spring.jpa.open-in-view (el perfil de pruebas ya lo hace).
    @Transactional(readOnly = true)
    public OrdenResponse obtener(Long id) {
        return OrdenResponse.from(buscarOFallar(id));
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarActivos() {
        return ordenRepository.findActivos().stream().map(OrdenResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarActivosYCompletadosHoy() {
        return ordenRepository.findActivosYCompletadosHoy().stream().map(OrdenResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarTodos() {
        return ordenRepository.findAllByOrderByCreadoEnDesc().stream().map(OrdenResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarParaCocina() {
        return ordenRepository.findParaCocina().stream().map(OrdenResponse::from).toList();
    }

    /**
     * S10: pedidos de delivery listos que todavía no tomó ningún repartidor, del más viejo al más
     * nuevo. Un pedido ya tomado no aparece aunque siga en LISTO.
     */
    @Transactional(readOnly = true)
    public List<OrdenResponse> listarDisponiblesParaEntrega() {
        return ordenRepository.findDisponiblesParaEntrega().stream().map(OrdenResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarPorCliente(Long clienteId) {
        return ordenRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(OrdenResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<OrdenResponse> listarPorEstado(OrdenEstado estado) {
        return ordenRepository.findByEstadoOrderByCreadoEnDesc(estado)
                .stream().map(OrdenResponse::from).toList();
    }

    /**
     * Ruta de confianza: la usan el scheduler y los métodos internos de este servicio, que ya
     * validaron sus propias precondiciones. Equivale a {@code llamadaInterna = true}.
     */
    @Transactional
    public OrdenResponse actualizarEstado(Long id, ActualizarEstadoRequest request, Long usuarioId) {
        return actualizarEstado(id, request, usuarioId, true);
    }

    /**
     * @param llamadaInterna true si la llamada es de confianza (clave interna de otro microservicio,
     *                       scheduler o método interno); false para el PATCH genérico del personal,
     *                       que no puede saltarse el pago, la llamada de confirmación ni el cobro.
     */
    @Transactional
    public OrdenResponse actualizarEstado(Long id, ActualizarEstadoRequest request, Long usuarioId,
                                          boolean llamadaInterna) {
        Orden orden = buscarOFallar(id);
        validarTransicionEstado(orden.getEstado(), request.getEstado(), orden.getTipo());
        if (!llamadaInterna) {
            validarCompuertasDeNegocio(orden, request.getEstado());
        }
        validarTicketDeRecojo(orden, request);

        boolean esDelivery = orden.getTipo() == OrdenTipo.DELIVERY;
        if (request.getEstado() == OrdenEstado.EN_CAMINO) {
            if (!esDelivery) {
                throw new IllegalArgumentException("Solo un pedido de delivery puede pasar a EN_CAMINO.");
            }
            Long repartidor = request.getRepartidorId() != null
                    ? request.getRepartidorId()
                    : orden.getRepartidorId();
            if (repartidor == null || repartidor <= 0) {
                throw new IllegalArgumentException(
                        "Asigná un motorizado antes de pasar el pedido a EN_CAMINO.");
            }
            orden.setRepartidorId(repartidor);
        } else if (esDelivery && request.getRepartidorId() != null) {
            orden.setRepartidorId(request.getRepartidorId());
        }

        if (request.getEstado() == OrdenEstado.EN_PUERTA && orden.getEnPuertaAt() == null) {
            orden.setEnPuertaAt(LocalDateTime.now());
        }

        if (request.getEstado().esListo() && orden.getListoAt() == null) {
            orden.setListoAt(LocalDateTime.now());
        }

        if (request.getEstado() == OrdenEstado.PEDIDO_FANTASMA && orden.getMotivoFantasma() == null) {
            orden.setMotivoFantasma(orden.getTipo() == OrdenTipo.DELIVERY ? "NO_ENTREGADO" : "ABANDONADO");
        }

        orden.setEstado(request.getEstado());

        // Liberar mesa cuando la orden termina en salón
        if (orden.getMesa() != null &&
                (request.getEstado() == OrdenEstado.ENTREGADO || request.getEstado() == OrdenEstado.CANCELADO || request.getEstado() == OrdenEstado.PEDIDO_FANTASMA)) {
            orden.getMesa().setEstado(MesaEstado.LIBRE);
        }

        ordenRepository.save(orden);
        log.info("Orden #{} → {} (usuario: {})", id, request.getEstado(), usuarioId);
        notificationService.notificarCambioEstado(orden, request.getEstado());

        if (request.getEstado() == OrdenEstado.PEDIDO_FANTASMA && sancionDispatcherService != null) {
            sancionDispatcherService.registrarSancionPorPedidoFantasma(orden, orden.getMotivoFantasma());
        }

        if (request.getEstado().esListo()) {
            salonEventPublisher.notificarPedidoListo(orden);
        }
        if (orden.getMesa() != null) {
            salonEventPublisher.notificarMesaActualizada(mesaService.mapearMesaConOrdenActiva(orden.getMesa()));
        }

        return OrdenResponse.from(orden);
    }

    /** States from which the customer (guest or owner) may still cancel: nothing was cooked yet. */
    private static final List<OrdenEstado> ESTADOS_CANCELABLES_POR_CLIENTE = List.of(
            OrdenEstado.RECIBIDO,
            OrdenEstado.PENDIENTE_PAGO,
            OrdenEstado.PENDIENTE_CONFIRMACION
    );

    /**
     * Cancellation requested by the customer (guest tracking access or the authenticated owner).
     * The state machine runs first, so a delivered or on-the-way order still answers 400; an order
     * the kitchen already started answers 409. Cancelling an already CANCELADO order stays a no-op.
     */
    @Transactional
    public OrdenResponse cancelarComoCliente(Long id, Long usuarioId) {
        Orden orden = buscarOFallar(id);
        if (orden.getEstado() != OrdenEstado.CANCELADO) {
            validarTransicionEstado(orden.getEstado(), OrdenEstado.CANCELADO, orden.getTipo());
            if (!ESTADOS_CANCELABLES_POR_CLIENTE.contains(orden.getEstado())) {
                throw new ConflictoDeEstadoException(
                        "El pedido #" + id + " ya está " + orden.getEstado()
                        + " y no puede cancelarse; comunícate con la pollería.");
            }
        }
        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.CANCELADO);
        return actualizarEstado(id, req, usuarioId);
    }

    /**
     * A RECOJO order is handed over only against its ticket (POL-&lt;order id&gt;), compared ignoring
     * case, spaces and dashes. The customer number is not accepted: it is short and guessable.
     */
    private void validarTicketDeRecojo(Orden orden, ActualizarEstadoRequest request) {
        if (orden.getTipo() != OrdenTipo.RECOJO || request.getEstado() != OrdenEstado.ENTREGADO
                || orden.getEstado() == OrdenEstado.ENTREGADO) {
            return;
        }
        String codigo = request.getCodigoTicket();
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("El código de ticket es obligatorio para entregar el pedido de recojo #"
                    + orden.getId() + ".");
        }
        String normalizado = codigo.replaceAll("[\\s-]", "").toUpperCase(java.util.Locale.ROOT);
        if (!normalizado.equals("POL" + orden.getId())) {
            throw new IllegalArgumentException("El código de ticket no corresponde al pedido #" + orden.getId() + ".");
        }
    }

    /**
     * S3.1: el mozo marca que ya entregó el pedido en mesa. Es una marca persistida, no un estado:
     * la orden sigue en LISTO y la mesa se libera recién al cobrar (LISTO → ENTREGADO).
     * Idempotente: si ya estaba servida devuelve la misma marca sin reescribirla.
     */
    @Transactional
    public OrdenResponse marcarServido(Long id, Long usuarioId) {
        Orden orden = buscarOFallarConBloqueo(id);

        if (orden.getTipo() != OrdenTipo.SALON) {
            throw new IllegalArgumentException(
                    "Solo las comandas de salón se marcan como servidas; el pedido #" + id
                    + " es de tipo " + orden.getTipo() + ".");
        }

        if (ESTADOS_TERMINALES.contains(orden.getEstado())) {
            throw new ConflictoDeEstadoException(
                    "La comanda #" + id + " ya está " + orden.getEstado()
                    + " y no puede marcarse como servida.");
        }

        if (orden.getServidoEn() != null) {
            return OrdenResponse.from(orden);
        }

        if (!orden.getEstado().esListo()) {
            throw new ConflictoDeEstadoException(
                    "La comanda #" + id + " todavía no está lista (estado actual: "
                    + orden.getEstado() + ").");
        }

        orden.setServidoEn(LocalDateTime.now());
        orden.setServidoPor(usuarioId != null && usuarioId > 0 ? usuarioId : null);

        ordenRepository.save(orden);
        log.info("Comanda #{} marcada como servida en mesa (usuario: {})", id, usuarioId);
        if (orden.getMesa() != null) {
            salonEventPublisher.notificarMesaActualizada(mesaService.mapearMesaConOrdenActiva(orden.getMesa()));
        }
        return OrdenResponse.from(orden);
    }

    /**
     * S10 — reclamo atómico del pedido por parte del repartidor.
     *
     * El bloqueo pesimista sobre la fila es lo que garantiza que un pedido no se reparta dos
     * veces: si dos repartidores reclaman a la vez, el segundo espera a que el primero confirme y
     * después ve el {@code repartidorId} ya asignado, así que recibe 409 en vez de pisarlo (el
     * {@code @Version} de la entidad es la segunda red por si la escritura no pasara por el lock).
     *
     * No cambia el estado: pasar a {@code EN_CAMINO} sigue siendo la acción explícita y separada
     * del repartidor, y esa transición ya exige que haya {@code repartidorId} — justo lo que este
     * reclamo provee.
     */
    @Transactional
    public OrdenResponse reclamarParaEntrega(Long id, Long repartidorId) {
        if (repartidorId == null || repartidorId <= 0) {
            throw new IllegalArgumentException("No se pudo identificar al repartidor que toma el pedido.");
        }

        Orden orden = buscarOFallarConBloqueo(id);

        if (orden.getTipo() != OrdenTipo.DELIVERY) {
            throw new ConflictoDeEstadoException(
                    "Solo los pedidos de delivery se pueden tomar para entrega; el pedido #" + id
                    + " es de tipo " + orden.getTipo() + ".");
        }

        if (!orden.getEstado().esListo()) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " todavía no está listo para entregar (estado actual: "
                    + orden.getEstado() + ").");
        }

        if (orden.getRepartidorId() != null && orden.getRepartidorId() > 0) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " ya fue tomado por un repartidor.");
        }

        orden.setRepartidorId(repartidorId);
        ordenRepository.save(orden);
        log.info("Pedido #{} tomado por el repartidor {} para entrega (sigue en {})",
                id, repartidorId, orden.getEstado());
        return OrdenResponse.from(orden);
    }

    /**
     * Confirma la llamada de validación para un pedido en PENDIENTE_CONFIRMACION (ContraPago).
     * Pasa la orden a PREPARANDO para que cocina comience a elaborar.
     *
     * After the 15 min window the order is cancelled (as the scheduler would) and the call answers
     * 409. {@code noRollbackFor} keeps that cancellation even though the method throws.
     */
    @Transactional(noRollbackFor = ConflictoDeEstadoException.class)
    public OrdenResponse confirmarLlamada(Long id, Long cajeroId) {
        Orden orden = buscarOFallarConBloqueo(id);
        if (orden.getEstado() != OrdenEstado.PENDIENTE_CONFIRMACION) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " no está en PENDIENTE_CONFIRMACION (estado actual: " + orden.getEstado() + ")");
        }
        if (orden.getCreadoEn() != null
                && LocalDateTime.now().isAfter(orden.getCreadoEn().plusMinutes(MINUTOS_PLAZO_CONFIRMACION))) {
            log.warn("Pedido #{} cancelado: la llamada se confirmó fuera del plazo de {} min",
                    id, MINUTOS_PLAZO_CONFIRMACION);
            ActualizarEstadoRequest cancelacion = new ActualizarEstadoRequest();
            cancelacion.setEstado(OrdenEstado.CANCELADO);
            actualizarEstado(id, cancelacion, cajeroId);
            throw new ConflictoDeEstadoException("El plazo de 15 minutos para confirmar la llamada venció");
        }
        orden.setLlamadaConfirmacionAt(LocalDateTime.now());
        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.PREPARANDO);
        return actualizarEstado(id, req, cajeroId);
    }

    /**
     * Registra un intento fallido de llamada para ContraPago.
     * Si alcanza 2 intentos fallidos, el pedido se cancela automáticamente.
     */
    @Transactional
    public OrdenResponse registrarIntentoLlamada(Long id, Long cajeroId, String observaciones) {
        Orden orden = buscarOFallarConBloqueo(id);
        if (orden.getEstado() != OrdenEstado.PENDIENTE_CONFIRMACION) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " no está en PENDIENTE_CONFIRMACION (estado actual: " + orden.getEstado() + ")");
        }
        int intentos = (orden.getIntentosLlamada() != null ? orden.getIntentosLlamada() : 0) + 1;
        orden.setIntentosLlamada(intentos);
        if (observaciones != null && !observaciones.isBlank()) {
            String obsPrevia = orden.getObservaciones() != null ? orden.getObservaciones() + " | " : "";
            orden.setObservaciones(obsPrevia + "Intento llamada " + intentos + ": " + observaciones);
        }
        if (intentos >= 2) {
            log.warn("Pedido #{} cancelado tras 2 intentos de llamada fallidos", id);
            ActualizarEstadoRequest req = new ActualizarEstadoRequest();
            req.setEstado(OrdenEstado.CANCELADO);
            return actualizarEstado(id, req, cajeroId);
        }
        ordenRepository.save(orden);
        return OrdenResponse.from(orden);
    }

    /**
     * El repartidor notifica que llegó al domicilio del cliente e inicia el cronómetro de 30 min.
     */
    @Transactional
    public OrdenResponse marcarEnPuerta(Long id, Long repartidorId) {
        Orden orden = buscarOFallarConBloqueo(id);
        if (orden.getTipo() != OrdenTipo.DELIVERY) {
            throw new IllegalArgumentException("Solo pedidos de delivery pueden pasar a EN_PUERTA");
        }
        if (orden.getEstado() != OrdenEstado.EN_CAMINO) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " debe estar EN_CAMINO para marcar EN_PUERTA (actual: " + orden.getEstado() + ")");
        }
        if (orden.getRepartidorId() != null && repartidorId != null && repartidorId > 0
                && !orden.getRepartidorId().equals(repartidorId)) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + id + " está asignado al motorizado #" + orden.getRepartidorId()
                    + "; el motorizado #" + repartidorId + " no puede marcarlo en puerta.");
        }
        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.EN_PUERTA);
        req.setRepartidorId(repartidorId);
        return actualizarEstado(id, req, repartidorId);
    }

    /**
     * Declara un pedido como fantasma y dispara el protocolo de sanción y merma.
     */
    @Transactional
    public OrdenResponse declararPedidoFantasma(Long id, String motivo, Long usuarioId) {
        Orden orden = buscarOFallarConBloqueo(id);
        if (ESTADOS_TERMINALES.contains(orden.getEstado())) {
            throw new ConflictoDeEstadoException("El pedido #" + id + " ya está en estado terminal: " + orden.getEstado());
        }
        if (usuarioId != null && usuarioId > 0) {
            validarPlazoPedidoFantasma(orden);
        }
        String motivoFinal = (motivo != null && !motivo.isBlank())
                ? motivo
                : (orden.getTipo() == OrdenTipo.DELIVERY ? "NO_ENTREGADO" : "ABANDONADO");
        orden.setMotivoFantasma(motivoFinal);

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.PEDIDO_FANTASMA);
        return actualizarEstado(id, req, usuarioId);
    }

    /** Window to confirm a ContraPago call, counted from the order creation (same SLA as the scheduler). */
    static final long MINUTOS_PLAZO_CONFIRMACION = 15;
    /** Plazo en puerta (delivery) antes de poder declarar el pedido fantasma. */
    static final long MINUTOS_ESPERA_PUERTA = 30;
    /** Plazo en tienda (recojo) antes de poder declarar el pedido fantasma. */
    static final long MINUTOS_ESPERA_RECOJO = 60;

    /**
     * Compuertas del PATCH genérico del personal: el pago verificado, la llamada de confirmación y
     * el cobro en efectivo se registran por sus flujos propios y no se pueden saltar con un estado.
     */
    private void validarCompuertasDeNegocio(Orden orden, OrdenEstado nuevo) {
        OrdenEstado actual = orden.getEstado();
        if (actual == nuevo) return;

        if (nuevo == OrdenEstado.PEDIDO_FANTASMA) {
            throw new ConflictoDeEstadoException(
                    "El pedido fantasma se declara con POST /ordenes/" + orden.getId()
                    + "/pedido-fantasma, no cambiando el estado.");
        }
        if (nuevo.esPreparacion()) {
            if (actual == OrdenEstado.PENDIENTE_PAGO) {
                throw new ConflictoDeEstadoException(
                        "El pedido #" + orden.getId() + " espera pago: el pago debe verificarse "
                        + "a través del flujo de pagos (payments-service) antes de pasar a preparación.");
            }
            if (actual == OrdenEstado.PENDIENTE_CONFIRMACION && orden.getLlamadaConfirmacionAt() == null) {
                throw new ConflictoDeEstadoException(
                        "El pedido #" + orden.getId() + " requiere confirmar la llamada al cliente: "
                        + "usa POST /ordenes/" + orden.getId() + "/confirmar-llamada.");
            }
        }
        if (nuevo == OrdenEstado.ENTREGADO
                && (orden.getTipo() == OrdenTipo.DELIVERY || orden.getTipo() == OrdenTipo.RECOJO)
                && Boolean.TRUE.equals(orden.getRequiereCobroEfectivo())) {
            throw new ConflictoDeEstadoException(
                    "El pedido #" + orden.getId() + " se paga en efectivo: registra el cobro "
                    + "(payments cobro-efectivo) antes de marcarlo como ENTREGADO.");
        }
    }

    /** Un actor humano solo puede declarar fantasma cuando ya venció la espera del tipo de pedido. */
    private void validarPlazoPedidoFantasma(Orden orden) {
        LocalDateTime ahora = LocalDateTime.now();
        if (orden.getTipo() == OrdenTipo.DELIVERY) {
            if (orden.getEstado() != OrdenEstado.EN_PUERTA || orden.getEnPuertaAt() == null) {
                throw new ConflictoDeEstadoException(
                        "El pedido #" + orden.getId() + " debe estar EN_PUERTA para declararlo fantasma.");
            }
            exigirEspera(orden, orden.getEnPuertaAt().plusMinutes(MINUTOS_ESPERA_PUERTA), ahora, "en la puerta");
        } else if (orden.getTipo() == OrdenTipo.RECOJO) {
            if (!orden.getEstado().esListo() || orden.getListoAt() == null) {
                throw new ConflictoDeEstadoException(
                        "El pedido #" + orden.getId() + " debe estar listo para recoger para declararlo fantasma.");
            }
            exigirEspera(orden, orden.getListoAt().plusMinutes(MINUTOS_ESPERA_RECOJO), ahora, "en tienda");
        }
    }

    private void exigirEspera(Orden orden, LocalDateTime venceEn, LocalDateTime ahora, String lugar) {
        if (venceEn.isAfter(ahora)) {
            long faltan = java.time.Duration.between(ahora, venceEn).toMinutes() + 1;
            throw new ConflictoDeEstadoException(
                    "Aún no se cumple la espera " + lugar + " del pedido #" + orden.getId()
                    + ": faltan " + faltan + " min para declararlo fantasma.");
        }
    }

    private void validarRequest(CrearOrdenRequest request) {
        if (request.getTipo() == OrdenTipo.SALON && request.getMesaId() == null) {
            throw new IllegalArgumentException("El número de mesa es obligatorio para pedidos de salón");
        }
        if (request.getTipo() == OrdenTipo.DELIVERY) {
            if (request.getDireccionEntrega() == null || request.getDireccionEntrega().isBlank()) {
                throw new IllegalArgumentException("La dirección de entrega es obligatoria para delivery");
            }
        }
        // POST /ordenes is public: an order may only start waiting for its payment (capture or
        // call). Any later state would send it to the kitchen without the cashier's validation.
        if (request.getEstadoInicial() != null && !ESTADOS_INICIALES_PERMITIDOS.contains(request.getEstadoInicial())) {
            throw new IllegalArgumentException("El estado inicial " + request.getEstadoInicial()
                    + " no está permitido: use RECIBIDO, PENDIENTE_PAGO o PENDIENTE_CONFIRMACION");
        }
    }

    private void validarTransicionEstado(OrdenEstado actual, OrdenEstado nuevo, OrdenTipo tipo) {
        if (actual == nuevo) return;

        // Terminal states cannot be changed
        if (actual == OrdenEstado.ENTREGADO || actual == OrdenEstado.CANCELADO || actual == OrdenEstado.PEDIDO_FANTASMA) {
            throw new IllegalArgumentException("Transición de estado inválida: " + actual + " → " + nuevo);
        }

        // An order on its way or at the door has left the store: it ends as ENTREGADO or
        // PEDIDO_FANTASMA, never cancelled (the food and the courier trip are already spent).
        if (nuevo == OrdenEstado.CANCELADO
                && (actual == OrdenEstado.EN_CAMINO || actual == OrdenEstado.EN_PUERTA)) {
            throw new IllegalArgumentException("El pedido ya salió a reparto (" + actual
                    + ") y no se puede cancelar: márcalo ENTREGADO o PEDIDO_FANTASMA.");
        }

        // Any other active order can be cancelled
        if (nuevo == OrdenEstado.CANCELADO) return;

        // Transitions to PEDIDO_FANTASMA
        if (nuevo == OrdenEstado.PEDIDO_FANTASMA) {
            if (tipo == OrdenTipo.DELIVERY && (actual == OrdenEstado.EN_PUERTA || actual == OrdenEstado.EN_CAMINO)) return;
            if (tipo == OrdenTipo.RECOJO && actual.esListo()) return;
            throw new IllegalArgumentException("Transición a PEDIDO_FANTASMA no permitida desde " + actual + " para tipo " + tipo);
        }

        boolean valido = switch (actual) {
            case RECIBIDO -> nuevo.esPreparacion() || nuevo == OrdenEstado.PENDIENTE_CONFIRMACION || nuevo == OrdenEstado.PENDIENTE_PAGO;
            case PENDIENTE_CONFIRMACION -> nuevo.esPreparacion();
            case PENDIENTE_PAGO -> nuevo.esPreparacion();
            case EN_PREPARACION, PREPARANDO -> nuevo.esListo();
            case LISTO, LISTO_PARA_ENTREGAR -> (tipo == OrdenTipo.DELIVERY)
                    ? (nuevo == OrdenEstado.EN_CAMINO || nuevo == OrdenEstado.ENTREGADO)
                    : (nuevo == OrdenEstado.ENTREGADO);
            case EN_CAMINO -> nuevo == OrdenEstado.EN_PUERTA || nuevo == OrdenEstado.ENTREGADO;
            case EN_PUERTA -> nuevo == OrdenEstado.ENTREGADO;
            default -> false;
        };

        if (!valido) {
            log.warn("Transición de estado rechazada: {} → {} (tipo: {})", actual, nuevo, tipo);
            throw new IllegalArgumentException("Transición de estado inválida: " + actual + " → " + nuevo);
        }
    }

    public Orden buscarOFallar(Long id) {
        return ordenRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Orden no encontrada: " + id));
    }

    /**
     * Igual que {@link #buscarOFallar(Long)} pero con bloqueo pesimista sobre la fila de la orden.
     * Se usa en mutaciones idempotentes/acumulativas para que dos peticiones simultáneas no se
     * pisen (servir dos veces, agregar ítems en paralelo).
     */
    private Orden buscarOFallarConBloqueo(Long id) {
        return ordenRepository.buscarConBloqueo(id)
                .orElseThrow(() -> new NoSuchElementException("Orden no encontrada: " + id));
    }
}
