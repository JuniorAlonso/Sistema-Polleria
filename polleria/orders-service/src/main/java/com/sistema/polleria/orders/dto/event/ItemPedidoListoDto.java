package com.sistema.polleria.orders.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ItemPedidoListoDto {
    private String nombre;
    private Integer cantidad;
    private String notas;
}
