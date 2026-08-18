package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MesaResponse {
    private Long id;
    private Integer numero;
    private Integer capacidad;
    private MesaEstado estado;
    private String qrUrl;

    public static MesaResponse from(Mesa m) {
        return MesaResponse.builder()
                .id(m.getId())
                .numero(m.getNumero())
                .capacidad(m.getCapacidad())
                .estado(m.getEstado())
                .qrUrl(m.getQrUrl())
                .build();
    }
}
