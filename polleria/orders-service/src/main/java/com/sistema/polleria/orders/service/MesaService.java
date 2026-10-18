package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarMesaRequest;
import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenActivaResponse;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.MesaRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MesaService {

    private final MesaRepository mesaRepository;
    private final OrdenRepository ordenRepository;
    private final SalonEventPublisher salonEventPublisher;

    private static final List<OrdenEstado> ESTADOS_TERMINALES = List.of(
            OrdenEstado.ENTREGADO,
            OrdenEstado.CANCELADO
    );

    public List<MesaResponse> listarTodas() {
        return listarTodas(false);
    }

    @Transactional(readOnly = true)
    public List<MesaResponse> listarTodas(boolean incluirInactivas) {
        List<Mesa> mesas = incluirInactivas
                ? mesaRepository.findAll()
                : mesaRepository.findByActivoTrueOrderByNumeroAsc();

        if (mesas.isEmpty()) {
            return List.of();
        }

        // Una sola consulta para todas las comandas activas del salón. Antes se hacía una
        // consulta por mesa (N+1) y cada cliente que hace polling multiplicaba la carga.
        List<Long> mesaIds = mesas.stream().map(Mesa::getId).toList();
        Map<Long, Orden> activasPorMesa = ordenRepository
                .findByMesaIdInAndEstadoNotIn(mesaIds, ESTADOS_TERMINALES)
                .stream()
                .collect(Collectors.toMap(o -> o.getMesa().getId(), Function.identity(), (a, b) -> a));

        return mesas.stream()
                .map(mesa -> {
                    Orden activa = mesa.getEstado() != MesaEstado.LIBRE
                            ? activasPorMesa.get(mesa.getId())
                            : null;
                    return MesaResponse.from(mesa, activa != null ? OrdenActivaResponse.from(activa) : null);
                })
                .toList();
    }

    public List<MesaResponse> listarLibres() {
        return mesaRepository.findByEstadoAndActivoTrue(MesaEstado.LIBRE)
                .stream()
                .map(MesaResponse::from)
                .toList();
    }

    public MesaResponse obtener(Long id) {
        return mapearMesaConOrdenActiva(buscarOFallar(id));
    }

    public OrdenActivaResponse obtenerOrdenActiva(Long id) {
        buscarOFallar(id);
        List<Orden> ordenesActivas = ordenRepository.findByMesaIdAndEstadoNotIn(id, ESTADOS_TERMINALES);
        if (!ordenesActivas.isEmpty()) {
            return OrdenActivaResponse.from(ordenesActivas.get(0));
        }
        return null;
    }

    @Transactional
    public MesaResponse crear(Integer numero, Integer capacidad, Integer posicionX, Integer posicionY) {
        return crear(numero, capacidad, posicionX, posicionY, "SALON_PRINCIPAL");
    }

    @Transactional
    public MesaResponse crear(Integer numero, Integer capacidad, Integer posicionX, Integer posicionY, String zona) {
        if (mesaRepository.existsByNumero(numero)) {
            throw new IllegalArgumentException("Ya existe la mesa número " + numero);
        }
        Mesa mesa = Mesa.builder()
                .numero(numero)
                .capacidad(capacidad)
                .posicionX(posicionX != null ? posicionX : 0)
                .posicionY(posicionY != null ? posicionY : 0)
                .zona(zona != null && !zona.isBlank() ? zona : "SALON_PRINCIPAL")
                .activo(true)
                .build();
        mesaRepository.save(mesa);
        log.info("Mesa {} creada en zona {} - posición ({}, {})", numero, mesa.getZona(), mesa.getPosicionX(), mesa.getPosicionY());
        MesaResponse response = MesaResponse.from(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
    }

    @Transactional
    public MesaResponse actualizarMesa(Long id, ActualizarMesaRequest request) {
        Mesa mesa = buscarOFallar(id);

        if (request.getNumero() != null && !request.getNumero().equals(mesa.getNumero())) {
            if (mesaRepository.existsByNumeroAndIdNot(request.getNumero(), id)) {
                throw new IllegalArgumentException("Ya existe otra mesa con el número " + request.getNumero());
            }
            mesa.setNumero(request.getNumero());
        }

        if (request.getCapacidad() != null) {
            if (request.getCapacidad() <= 0) {
                throw new IllegalArgumentException("La capacidad debe ser mayor a 0");
            }
            mesa.setCapacidad(request.getCapacidad());
        }

        if (request.getPosicionX() != null) {
            mesa.setPosicionX(request.getPosicionX());
        }

        if (request.getPosicionY() != null) {
            mesa.setPosicionY(request.getPosicionY());
        }

        if (request.getZona() != null && !request.getZona().isBlank()) {
            mesa.setZona(request.getZona());
        }

        if (request.getActivo() != null) {
            mesa.setActivo(request.getActivo());
        }

        mesaRepository.save(mesa);
        log.info("Mesa #{} modificada por admin", mesa.getNumero());
        MesaResponse response = mapearMesaConOrdenActiva(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
    }

    @Transactional
    public MesaResponse actualizarEstado(Long id, MesaEstado nuevoEstado) {
        return actualizarEstado(id, nuevoEstado, false);
    }

    @Transactional
    public MesaResponse actualizarEstado(Long id, MesaEstado nuevoEstado, Boolean forzar) {
        Mesa mesa = buscarOFallar(id);
        MesaEstado actual = mesa.getEstado();

        if (actual == nuevoEstado) {
            return mapearMesaConOrdenActiva(mesa);
        }

        boolean esForzado = Boolean.TRUE.equals(forzar);
        if (!esForzado && !esTransicionValida(actual, nuevoEstado)) {
            String errorMsg = String.format(
                    "Transición de estado de mesa inválida: %s → %s. Transiciones permitidas desde %s: %s",
                    actual, nuevoEstado, actual, transicionesPermitidas(actual)
            );
            log.warn(errorMsg);
            throw new ConflictoDeEstadoException(errorMsg);
        }

        // Liberar o pasar a limpieza una mesa con comanda activa dejaba la comanda huérfana:
        // la mesa quedaba LIBRE, mapearMesaConOrdenActiva ocultaba la comanda y no había forma
        // de cobrarla. Primero se cobra o se cancela; forzar=true sigue siendo el override.
        if (!esForzado && (nuevoEstado == MesaEstado.LIBRE || nuevoEstado == MesaEstado.EN_LIMPIEZA)) {
            List<Orden> comandasActivas = ordenRepository.findByMesaIdAndEstadoNotIn(mesa.getId(), ESTADOS_TERMINALES);
            if (!comandasActivas.isEmpty()) {
                Orden comanda = comandasActivas.get(0);
                String errorMsg = String.format(
                        "No se puede pasar la mesa #%d a %s porque tiene la comanda #%d en estado %s. "
                        + "Cóbrala o cancélala antes de liberar la mesa.",
                        mesa.getNumero(), nuevoEstado, comanda.getId(), comanda.getEstado()
                );
                log.warn(errorMsg);
                throw new ConflictoDeEstadoException(errorMsg);
            }
        }

        mesa.setEstado(nuevoEstado);
        mesaRepository.save(mesa);
        log.info("Mesa {} transición de estado: {} → {} (forzado: {})", mesa.getNumero(), actual, nuevoEstado, esForzado);

        MesaResponse response = mapearMesaConOrdenActiva(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
    }

    public static boolean esTransicionValida(MesaEstado actual, MesaEstado nuevo) {
        if (actual == nuevo) return true;
        return switch (actual) {
            case LIBRE -> nuevo == MesaEstado.OCUPADA || nuevo == MesaEstado.RESERVADA;
            case RESERVADA -> nuevo == MesaEstado.OCUPADA || nuevo == MesaEstado.LIBRE;
            case OCUPADA -> nuevo == MesaEstado.POR_COBRAR || nuevo == MesaEstado.EN_LIMPIEZA || nuevo == MesaEstado.LIBRE;
            case POR_COBRAR -> nuevo == MesaEstado.EN_LIMPIEZA || nuevo == MesaEstado.LIBRE || nuevo == MesaEstado.OCUPADA;
            case EN_LIMPIEZA -> nuevo == MesaEstado.LIBRE || nuevo == MesaEstado.OCUPADA;
        };
    }

    public static String transicionesPermitidas(MesaEstado actual) {
        return switch (actual) {
            case LIBRE -> "[OCUPADA, RESERVADA]";
            case RESERVADA -> "[OCUPADA, LIBRE]";
            case OCUPADA -> "[POR_COBRAR, EN_LIMPIEZA, LIBRE]";
            case POR_COBRAR -> "[EN_LIMPIEZA, LIBRE, OCUPADA]";
            case EN_LIMPIEZA -> "[LIBRE, OCUPADA]";
        };
    }

    @Transactional
    public MesaResponse actualizarPosicion(Long id, Integer posicionX, Integer posicionY) {
        Mesa mesa = buscarOFallar(id);
        mesa.setPosicionX(posicionX != null ? posicionX : 0);
        mesa.setPosicionY(posicionY != null ? posicionY : 0);
        mesaRepository.save(mesa);
        log.info("Mesa {} posición actualizada → ({}, {})", mesa.getNumero(), mesa.getPosicionX(), mesa.getPosicionY());
        MesaResponse response = mapearMesaConOrdenActiva(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
    }

    @Transactional
    public void eliminar(Long id) {
        Mesa mesa = buscarOFallar(id);

        List<Orden> ordenesActivas = ordenRepository.findByMesaIdAndEstadoNotIn(id, ESTADOS_TERMINALES);
        if (!ordenesActivas.isEmpty()) {
            throw new ConflictoDeEstadoException("No se puede dar de baja la mesa #" + mesa.getNumero() + " porque tiene una comanda activa en curso");
        }

        // Soft delete para garantizar integridad con el histórico de órdenes y reportes
        mesa.setActivo(false);
        mesaRepository.save(mesa);
        log.info("Mesa #{} dada de baja (soft delete)", mesa.getNumero());

        MesaResponse response = mapearMesaConOrdenActiva(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
    }

    public Mesa buscarOFallar(Long id) {
        return mesaRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Mesa no encontrada: " + id));
    }

    /**
     * Igual que {@link #buscarOFallar(Long)} pero tomando un bloqueo pesimista sobre la fila
     * de la mesa. Debe invocarse dentro de una transacción; el bloqueo se libera al confirmar.
     * Se usa al abrir una comanda de salón para que la verificación de comanda activa y la
     * creación de la orden sean una única operación atómica.
     */
    @Transactional
    public Mesa buscarOFallarConBloqueo(Long id) {
        return mesaRepository.buscarConBloqueo(id)
                .orElseThrow(() -> new NoSuchElementException("Mesa no encontrada: " + id));
    }

    public MesaResponse mapearMesaConOrdenActiva(Mesa mesa) {
        OrdenActivaResponse ordenActiva = null;
        if (mesa.getEstado() != MesaEstado.LIBRE) {
            List<Orden> ordenesActivas = ordenRepository.findByMesaIdAndEstadoNotIn(mesa.getId(), ESTADOS_TERMINALES);
            if (!ordenesActivas.isEmpty()) {
                ordenActiva = OrdenActivaResponse.from(ordenesActivas.get(0));
            }
        }
        return MesaResponse.from(mesa, ordenActiva);
    }
}
