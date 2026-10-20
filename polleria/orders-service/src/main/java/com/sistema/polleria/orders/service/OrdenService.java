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

    private static final List<OrdenEstado> ESTADOS_TERMINALES = List.of(
            OrdenEstado.ENTREGADO,
            OrdenEstado.CANCELADO
    );

    @Transactional
    public OrdenResponse crear(CrearOrdenRequest request, Long usuarioId) {
        validarRequest(request);

        Orden orden = Orden.builder()
                .tipo(request.getTipo())
                .canalOrigen(resolverCanalOrigen(request))
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

        if (orden.getEstado() == OrdenEstado.LISTO) {
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

    @Transactional
    public OrdenResponse actualizarEstado(Long id, ActualizarEstadoRequest request, Long usuarioId) {
        Orden orden = buscarOFallar(id);
        validarTransicionEstado(orden.getEstado(), request.getEstado(), orden.getTipo());

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

        orden.setEstado(request.getEstado());

        // Liberar mesa cuando la orden termina en salón
        if (orden.getMesa() != null &&
                (request.getEstado() == OrdenEstado.ENTREGADO || request.getEstado() == OrdenEstado.CANCELADO)) {
            orden.getMesa().setEstado(MesaEstado.LIBRE);
        }

        ordenRepository.save(orden);
        log.info("Orden #{} → {} (usuario: {})", id, request.getEstado(), usuarioId);
        notificationService.notificarCambioEstado(orden, request.getEstado());

        if (request.getEstado() == OrdenEstado.LISTO) {
            salonEventPublisher.notificarPedidoListo(orden);
        }
        if (orden.getMesa() != null) {
            salonEventPublisher.notificarMesaActualizada(mesaService.mapearMesaConOrdenActiva(orden.getMesa()));
        }

        return OrdenResponse.from(orden);
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

        if (orden.getEstado() != OrdenEstado.LISTO) {
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

        if (orden.getEstado() != OrdenEstado.LISTO) {
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

    private void validarRequest(CrearOrdenRequest request) {
        if (request.getTipo() == OrdenTipo.SALON && request.getMesaId() == null) {
            throw new IllegalArgumentException("El número de mesa es obligatorio para pedidos de salón");
        }
        if (request.getTipo() == OrdenTipo.DELIVERY) {
            if (request.getDireccionEntrega() == null || request.getDireccionEntrega().isBlank()) {
                throw new IllegalArgumentException("La dirección de entrega es obligatoria para delivery");
            }
        }
    }

    private void validarTransicionEstado(OrdenEstado actual, OrdenEstado nuevo, OrdenTipo tipo) {
        if (actual == nuevo) return;

        // Terminal states cannot be changed
        if (actual == OrdenEstado.ENTREGADO || actual == OrdenEstado.CANCELADO) {
            throw new IllegalArgumentException("Transición de estado inválida: " + actual + " → " + nuevo);
        }

        // Any active order can be cancelled
        if (nuevo == OrdenEstado.CANCELADO) return;

        boolean valido = switch (actual) {
            case RECIBIDO -> nuevo == OrdenEstado.EN_PREPARACION;
            case EN_PREPARACION -> nuevo == OrdenEstado.LISTO;
            case LISTO -> (tipo == OrdenTipo.DELIVERY)
                    ? (nuevo == OrdenEstado.EN_CAMINO || nuevo == OrdenEstado.ENTREGADO)
                    : (nuevo == OrdenEstado.ENTREGADO);
            case EN_CAMINO -> nuevo == OrdenEstado.ENTREGADO;
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
