package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.ActualizarStockRequest;
import com.sistema.polleria.inventory.dto.CrearInsumoRequest;
import com.sistema.polleria.inventory.dto.InsumoResponse;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class InsumoService {

    private final InsumoRepository insumoRepository;

    public List<InsumoResponse> listarTodos() {
        return insumoRepository.findAll().stream().map(InsumoResponse::from).toList();
    }

    public InsumoResponse obtenerPorId(Long id) {
        return InsumoResponse.from(buscarOFallar(id));
    }

    @Transactional
    public InsumoResponse crear(CrearInsumoRequest req) {
        if (insumoRepository.existsByNombre(req.getNombre())) {
            throw new IllegalArgumentException("Ya existe un insumo con el nombre: " + req.getNombre());
        }

        Insumo insumo = Insumo.builder()
                .nombre(req.getNombre())
                .unidadMedida(req.getUnidadMedida().toUpperCase())
                .stockActual(req.getStockActual())
                .stockMinimoAlerta(req.getStockMinimoAlerta())
                .costoUnitario(req.getCostoUnitario())
                .build();

        insumo = insumoRepository.save(insumo);
        log.info("Insumo creado: #{} {}", insumo.getId(), insumo.getNombre());
        return InsumoResponse.from(insumo);
    }

    @Transactional
    public InsumoResponse actualizarStock(Long id, ActualizarStockRequest req) {
        Insumo insumo = buscarOFallar(id);
        BigDecimal nuevoStock;
        if (req.isEsDelta()) {
            nuevoStock = insumo.getStockActual().add(req.getCantidad());
        } else {
            nuevoStock = req.getCantidad();
        }

        if (nuevoStock.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El stock resultante no puede ser negativo");
        }

        insumo.setStockActual(nuevoStock);
        insumo = insumoRepository.save(insumo);
        log.info("Stock actualizado para insumo #{}: {} {}", insumo.getId(), nuevoStock, insumo.getUnidadMedida());
        return InsumoResponse.from(insumo);
    }

    @Transactional
    public void eliminar(Long id) {
        buscarOFallar(id);
        insumoRepository.deleteById(id);
    }

    public Insumo buscarOFallar(Long id) {
        return insumoRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Insumo no encontrado: " + id));
    }
}
