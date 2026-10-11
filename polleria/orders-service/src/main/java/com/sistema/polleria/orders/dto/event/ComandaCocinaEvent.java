package com.sistema.polleria.orders.dto.event;

import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.OrdenTipo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComandaCocinaEvent {
    @Builder.Default
    private String evento = "NUEVA_COMANDA";
    private Long ordenId;
    private OrdenTipo tipo;
    private Integer mesaNumero;
    private String nombreCliente;
    private String observaciones;
    private BigDecimal total;
    private List<OrdenResponse.ItemResponse> items;
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
