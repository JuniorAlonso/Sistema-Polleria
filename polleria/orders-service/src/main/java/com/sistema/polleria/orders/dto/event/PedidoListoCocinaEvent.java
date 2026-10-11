package com.sistema.polleria.orders.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PedidoListoCocinaEvent {
    @Builder.Default
    private String evento = "PEDIDO_LISTO_COCINA";
    private Long ordenId;
    private Integer mesaNumero;
    private Long mozoId;
    private String mozoNombre;
    private List<ItemPedidoListoDto> items;
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
