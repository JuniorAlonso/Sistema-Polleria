package com.sistema.polleria.finance.dto;

import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArqueoCajaResponse {
    private Long id;
    private Long usuarioId;
    private String usuarioNombre;
    private LocalDateTime fechaApertura;
    private BigDecimal montoApertura;
    private LocalDateTime fechaCierre;
    private BigDecimal montoCierreEfectivo;
    private BigDecimal montoCierrePos;
    private BigDecimal ventasDigitales;
    private BigDecimal totalEsperado;
    private BigDecimal diferencia;
    private EstadoCaja estado;
    private String observaciones;

    public static ArqueoCajaResponse from(ArqueoCaja a) {
        if (a == null) return null;
        return ArqueoCajaResponse.builder()
                .id(a.getId())
                .usuarioId(a.getUsuarioId())
                .usuarioNombre(a.getUsuarioNombre())
                .fechaApertura(a.getFechaApertura())
                .montoApertura(a.getMontoApertura())
                .fechaCierre(a.getFechaCierre())
                .montoCierreEfectivo(a.getMontoCierreEfectivo())
                .montoCierrePos(a.getMontoCierrePos())
                .ventasDigitales(a.getVentasDigitales())
                .totalEsperado(a.getTotalEsperado())
                .diferencia(a.getDiferencia())
                .estado(a.getEstado())
                .observaciones(a.getObservaciones())
                .build();
    }
}
