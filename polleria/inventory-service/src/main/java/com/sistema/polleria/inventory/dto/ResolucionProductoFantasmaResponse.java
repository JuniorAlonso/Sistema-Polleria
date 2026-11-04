package com.sistema.polleria.inventory.dto;

import com.sistema.polleria.inventory.entity.DestinoProductoFantasma;

import java.time.LocalDateTime;

public record ResolucionProductoFantasmaResponse(
        Long ordenId,
        DestinoProductoFantasma destino,
        String resultado,
        Long mermaId,
        LocalDateTime fecha
) {}
