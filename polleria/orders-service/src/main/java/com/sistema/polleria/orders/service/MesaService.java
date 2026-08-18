package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.repository.MesaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MesaService {

    private final MesaRepository mesaRepository;

    public List<MesaResponse> listarTodas() {
        return mesaRepository.findAll().stream().map(MesaResponse::from).toList();
    }

    public List<MesaResponse> listarLibres() {
        return mesaRepository.findByEstado(MesaEstado.LIBRE)
                .stream().map(MesaResponse::from).toList();
    }

    public MesaResponse obtener(Long id) {
        return MesaResponse.from(buscarOFallar(id));
    }

    @Transactional
    public MesaResponse crear(Integer numero, Integer capacidad) {
        if (mesaRepository.existsByNumero(numero)) {
            throw new IllegalArgumentException("Ya existe la mesa número " + numero);
        }
        Mesa mesa = Mesa.builder().numero(numero).capacidad(capacidad).build();
        mesaRepository.save(mesa);
        log.info("Mesa {} creada", numero);
        return MesaResponse.from(mesa);
    }

    @Transactional
    public MesaResponse actualizarEstado(Long id, MesaEstado estado) {
        Mesa mesa = buscarOFallar(id);
        mesa.setEstado(estado);
        mesaRepository.save(mesa);
        log.info("Mesa {} → {}", mesa.getNumero(), estado);
        return MesaResponse.from(mesa);
    }

    @Transactional
    public void eliminar(Long id) {
        buscarOFallar(id);
        mesaRepository.deleteById(id);
    }

    public Mesa buscarOFallar(Long id) {
        return mesaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Mesa no encontrada: " + id));
    }
}
