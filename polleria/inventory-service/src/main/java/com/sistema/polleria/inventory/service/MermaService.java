package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.MermaResponse;
import com.sistema.polleria.inventory.dto.RegistrarMermaRequest;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MermaService {

    private final MermaRepository mermaRepository;
    private final InsumoRepository insumoRepository;

    @Transactional
    public MermaResponse registrar(RegistrarMermaRequest req, Long registradoPor) {
        Insumo insumo = insumoRepository.findById(req.getInsumoId())
                .orElseThrow(() -> new IllegalArgumentException("Insumo no encontrado: " + req.getInsumoId()));

        // Descontar merma del stock actual si queda disponible
        if (insumo.getStockActual().compareTo(req.getCantidad()) >= 0) {
            insumo.setStockActual(insumo.getStockActual().subtract(req.getCantidad()));
        } else {
            insumo.setStockActual(BigDecimal.ZERO);
        }
        insumoRepository.save(insumo);

        Merma merma = Merma.builder()
                .insumoId(insumo.getId())
                .insumoNombre(insumo.getNombre())
                .cantidad(req.getCantidad())
                .motivo(req.getMotivo())
                .justificacion(req.getJustificacion())
                .registradoPor(registradoPor)
                .fecha(LocalDateTime.now())
                .build();

        merma = mermaRepository.save(merma);
        log.warn("Merma registrada: #{} - {} {} de {} (motivo: {})",
                merma.getId(), merma.getCantidad(), insumo.getUnidadMedida(), insumo.getNombre(), merma.getMotivo());

        return MermaResponse.from(merma);
    }

    public List<MermaResponse> listarTodas() {
        return mermaRepository.findAllByOrderByFechaDesc()
                .stream().map(MermaResponse::from).toList();
    }
}
