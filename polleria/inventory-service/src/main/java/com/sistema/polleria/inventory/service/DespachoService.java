package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.CrearDespachoRequest;
import com.sistema.polleria.inventory.dto.DespachoResponse;
import com.sistema.polleria.inventory.entity.DespachoCocina;
import com.sistema.polleria.inventory.entity.DespachoItem;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.repository.DespachoCocinaRepository;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DespachoService {

    private final DespachoCocinaRepository despachoRepository;
    private final InsumoRepository insumoRepository;

    @Transactional
    public DespachoResponse registrarDespacho(CrearDespachoRequest req, Long solicitanteId) {
        DespachoCocina despacho = DespachoCocina.builder()
                .solicitanteId(solicitanteId)
                .solicitanteNombre(req.getSolicitanteNombre() != null ? req.getSolicitanteNombre() : "Chef Cocina")
                .fechaDespacho(LocalDateTime.now())
                .items(new ArrayList<>())
                .build();

        for (var itemReq : req.getItems()) {
            Insumo insumo = insumoRepository.findById(itemReq.getInsumoId())
                    .orElseThrow(() -> new IllegalArgumentException("Insumo no encontrado: " + itemReq.getInsumoId()));

            if (insumo.getStockActual().compareTo(itemReq.getCantidad()) < 0) {
                throw new IllegalStateException(String.format("Stock insuficiente para %s. Disponible: %s %s, Solicitado: %s %s",
                        insumo.getNombre(), insumo.getStockActual(), insumo.getUnidadMedida(),
                        itemReq.getCantidad(), insumo.getUnidadMedida()));
            }

            // Descontar del almacén central
            insumo.setStockActual(insumo.getStockActual().subtract(itemReq.getCantidad()));
            insumoRepository.save(insumo);

            DespachoItem item = DespachoItem.builder()
                    .despacho(despacho)
                    .insumoId(insumo.getId())
                    .insumoNombre(insumo.getNombre())
                    .cantidad(itemReq.getCantidad())
                    .observaciones(itemReq.getObservaciones())
                    .build();

            despacho.getItems().add(item);
        }

        despacho = despachoRepository.save(despacho);
        log.info("Despacho a cocina #{} registrado con {} items para chef #{}",
                despacho.getId(), despacho.getItems().size(), solicitanteId);

        return DespachoResponse.from(despacho);
    }

    public List<DespachoResponse> listarTodos() {
        return despachoRepository.findAllByOrderByFechaDespachoDesc()
                .stream().map(DespachoResponse::from).toList();
    }
}
