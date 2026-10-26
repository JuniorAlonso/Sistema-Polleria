package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaRequest;
import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaResponse;
import com.sistema.polleria.inventory.entity.DestinoProductoFantasma;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResolucionProductoService {

    private final MermaRepository mermaRepository;
    private final InsumoRepository insumoRepository;

    @Transactional
    public ResolucionProductoFantasmaResponse resolver(ResolucionProductoFantasmaRequest req, Long usuarioId) {
        log.info("Resolviendo destino de producto para orden fantasma #{}: {} (Tipo: {})",
                req.ordenId(), req.destino(), req.ordenTipo());

        // Regla de inocuidad bromatológica: Delivery que estuvo en la calle no puede reasignarse a salón
        if ("DELIVERY".equalsIgnoreCase(req.ordenTipo()) && req.destino() == DestinoProductoFantasma.VENTA_RAPIDA_SALON) {
            throw new IllegalArgumentException(
                    "Por control bromatológico e inocuidad alimentaria, un pedido de Delivery retornado no puede reasignarse a salón. Debe registrarse como Merma Justificada.");
        }

        if (req.destino() == DestinoProductoFantasma.MERMA_JUSTIFICADA) {
            String obs = req.observaciones() != null ? req.observaciones() : "Sin observaciones adicionales";
            String justificacion = "Pedido Fantasma #" + req.ordenId() + " (" + (req.ordenTipo() != null ? req.ordenTipo() : "GENERAL") + "). " + obs;

            // Insumo representativo (Pollo Entero Fresco o id 1)
            Long insumoId = 1L;
            String insumoNombre = "Pollo Entero Fresco (Elaborado)";
            var optInsumo = insumoRepository.findById(1L);
            if (optInsumo.isPresent()) {
                insumoNombre = optInsumo.get().getNombre();
            }

            Merma merma = Merma.builder()
                    .insumoId(insumoId)
                    .insumoNombre(insumoNombre)
                    .cantidad(BigDecimal.ONE)
                    .motivo(MotivoMerma.PEDIDO_FANTASMA)
                    .justificacion(justificacion)
                    .registradoPor(usuarioId != null ? usuarioId : 1L)
                    .fecha(LocalDateTime.now())
                    .build();

            merma = mermaRepository.save(merma);
            log.warn("Merma justificada registrada #{} por Pedido Fantasma #{}", merma.getId(), req.ordenId());

            return new ResolucionProductoFantasmaResponse(
                    req.ordenId(),
                    DestinoProductoFantasma.MERMA_JUSTIFICADA,
                    "Registrado en libro de mermas oficiales por pérdida justificada de pedido fantasma",
                    merma.getId(),
                    merma.getFecha()
            );
        } else {
            // VENTA_RAPIDA_SALON
            log.info("Pedido fantasma de recojo en tienda #{} reasignado a mostrador / venta rápida en salón", req.ordenId());
            return new ResolucionProductoFantasmaResponse(
                    req.ordenId(),
                    DestinoProductoFantasma.VENTA_RAPIDA_SALON,
                    "Producto reasignado exitosamente a vitrina caliente / venta rápida en mostrador",
                    null,
                    LocalDateTime.now()
            );
        }
    }
}
