package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenActivaResponse;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.MesaRepository;
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
public class MesaService {

    private final MesaRepository mesaRepository;
    private final OrdenRepository ordenRepository;
    private final SalonEventPublisher salonEventPublisher;

    private static final List<OrdenEstado> ESTADOS_TERMINALES = List.of(
            OrdenEstado.ENTREGADO,
            OrdenEstado.CANCELADO
    );

    public List<MesaResponse> listarTodas() {
        return mesaRepository.findAll().stream()
                .map(this::mapearMesaConOrdenActiva)
                .toList();
    }

    public List<MesaResponse> listarLibres() {
        return mesaRepository.findByEstado(MesaEstado.LIBRE)
                .stream()
                .map(MesaResponse::from)
                .toList();
    }

    public MesaResponse obtener(Long id) {
        return mapearMesaConOrdenActiva(buscarOFallar(id));
    }

    @Transactional
    public MesaResponse crear(Integer numero, Integer capacidad, Integer posicionX, Integer posicionY) {
        if (mesaRepository.existsByNumero(numero)) {
            throw new IllegalArgumentException("Ya existe la mesa número " + numero);
        }
        Mesa mesa = Mesa.builder()
                .numero(numero)
                .capacidad(capacidad)
                .posicionX(posicionX != null ? posicionX : 0)
                .posicionY(posicionY != null ? posicionY : 0)
                .build();
        mesaRepository.save(mesa);
        log.info("Mesa {} creada en posición ({}, {})", numero, mesa.getPosicionX(), mesa.getPosicionY());
        MesaResponse response = MesaResponse.from(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
    }

    @Transactional
    public MesaResponse actualizarEstado(Long id, MesaEstado estado) {
        Mesa mesa = buscarOFallar(id);
        mesa.setEstado(estado);
        mesaRepository.save(mesa);
        log.info("Mesa {} → {}", mesa.getNumero(), estado);
        MesaResponse response = mapearMesaConOrdenActiva(mesa);
        salonEventPublisher.notificarMesaActualizada(response);
        return response;
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
        buscarOFallar(id);
        mesaRepository.deleteById(id);
    }

    public Mesa buscarOFallar(Long id) {
        return mesaRepository.findById(id)
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
