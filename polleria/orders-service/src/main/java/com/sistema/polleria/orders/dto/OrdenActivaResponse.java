package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrdenActivaResponse {
    private Long ordenId;
    private Long mozoId;
    private BigDecimal total;
    private OrdenEstado estadoOrden;
    private Long tiempoEsperaMinutos;

    public static OrdenActivaResponse from(Orden orden) {
        if (orden == null) return null;
        long minutos = 0;
        if (orden.getCreadoEn() != null) {
            minutos = Duration.between(orden.getCreadoEn(), LocalDateTime.now()).toMinutes();
        }
        return OrdenActivaResponse.builder()
                .ordenId(orden.getId())
                .mozoId(orden.getClienteId()) // En pedidos de salón, clienteId registra el usuario/mozo que creó la orden
                .total(orden.getTotal())
                .estadoOrden(orden.getEstado())
                .tiempoEsperaMinutos(minutos)
                .build();
    }
}
