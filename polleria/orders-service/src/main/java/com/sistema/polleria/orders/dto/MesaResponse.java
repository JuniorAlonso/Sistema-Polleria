package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MesaResponse {
    private Long id;
    private Integer numero;
    private Integer capacidad;
    private MesaEstado estado;
    private Integer posicionX;
    private Integer posicionY;
    private String qrUrl;
    private String zona;
    private Boolean activo;
    private Long version;
    private OrdenActivaResponse ordenActiva;

    public static MesaResponse from(Mesa m) {
        return from(m, null);
    }

    public static MesaResponse from(Mesa m, OrdenActivaResponse ordenActiva) {
        if (m == null) return null;
        return MesaResponse.builder()
                .id(m.getId())
                .numero(m.getNumero())
                .capacidad(m.getCapacidad())
                .estado(m.getEstado())
                .zona(m.getZona() != null ? m.getZona() : "SALON_PRINCIPAL")
                .activo(m.getActivo() != null ? m.getActivo() : true)
                .posicionX(m.getPosicionX() != null ? m.getPosicionX() : 0)
                .posicionY(m.getPosicionY() != null ? m.getPosicionY() : 0)
                .qrUrl(m.getQrUrl())
                .version(m.getVersion())
                .ordenActiva(ordenActiva)
                .build();
    }
}
