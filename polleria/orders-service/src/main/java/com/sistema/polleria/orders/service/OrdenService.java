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
        Orden orden = buscarOFallar(id);

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

    public List<OrdenResponse> listarActivos() {
        return ordenRepository.findActivos().stream().map(OrdenResponse::from).toList();
    }

    public List<OrdenResponse> listarActivosYCompletadosHoy() {
        return ordenRepository.findActivosYCompletadosHoy().stream().map(OrdenResponse::from).toList();
    }

    public List<OrdenResponse> listarTodos() {
        return ordenRepository.findAllByOrderByCreadoEnDesc().stream().map(OrdenResponse::from).toList();
    }

    public List<OrdenResponse> listarParaCocina() {
        return ordenRepository.findParaCocina().stream().map(OrdenResponse::from).toList();
    }

    public List<OrdenResponse> listarPorCliente(Long clienteId) {
        return ordenRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(OrdenResponse::from).toList();
    }

    public List<OrdenResponse> listarPorEstado(OrdenEstado estado) {
        return ordenRepository.findByEstadoOrderByCreadoEnDesc(estado)
                .stream().map(OrdenResponse::from).toList();
    }

    @Transactional
    public OrdenResponse actualizarEstado(Long id, ActualizarEstadoRequest request, Long usuarioId) {
        Orden orden = buscarOFallar(id);
        validarTransicionEstado(orden.getEstado(), request.getEstado(), orden.getTipo());

        orden.setEstado(request.getEstado());

        if (request.getRepartidorId() != null) {
            orden.setRepartidorId(request.getRepartidorId());
        }

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
}
