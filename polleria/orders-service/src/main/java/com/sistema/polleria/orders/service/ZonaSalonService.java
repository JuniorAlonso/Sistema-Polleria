package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ZonaSalonDTO;
import com.sistema.polleria.orders.entity.ZonaSalon;
import com.sistema.polleria.orders.repository.ZonaSalonRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ZonaSalonService {

    private final ZonaSalonRepository zonaSalonRepository;

    public List<ZonaSalonDTO> listarTodas() {
        return zonaSalonRepository.findByActivoTrueOrderByOrdenAsc()
                .stream()
                .map(ZonaSalonDTO::from)
                .toList();
    }

    public ZonaSalonDTO obtenerPorId(Long id) {
        return zonaSalonRepository.findById(id)
                .map(ZonaSalonDTO::from)
                .orElseThrow(() -> new NoSuchElementException("Zona de salón no encontrada con id: " + id));
    }

    @Transactional
    public ZonaSalonDTO actualizarDimensiones(Long id, Integer filas, Integer columnas) {
        ZonaSalon zona = zonaSalonRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Zona de salón no encontrada con id: " + id));
        if (filas != null && filas >= 1) zona.setFilas(filas);
        if (columnas != null && columnas >= 1) zona.setColumnas(columnas);
        zonaSalonRepository.save(zona);
        log.info("Zona {} dimensiones actualizadas: {}x{}", zona.getSlug(), zona.getFilas(), zona.getColumnas());
        return ZonaSalonDTO.from(zona);
    }
}
