package com.sistema.polleria.inventory.dto;

import com.sistema.polleria.inventory.entity.DestinoProductoFantasma;
import jakarta.validation.constraints.NotNull;

public record ResolucionProductoFantasmaRequest(
        @NotNull(message = "El ID de la orden es obligatorio")
        Long ordenId,

        String ordenTipo, // DELIVERY o RECOJO

        @NotNull(message = "El destino del producto es obligatorio")
        DestinoProductoFantasma destino,

        String observaciones
) {}
