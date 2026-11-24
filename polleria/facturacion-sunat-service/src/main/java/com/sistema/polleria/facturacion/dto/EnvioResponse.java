package com.sistema.polleria.facturacion.dto;

import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Lo que ve el frontend del envío a SUNAT (sin los archivos pesados: esos se descargan aparte). */
public record EnvioResponse(
        Long ordenId,
        Long comprobanteId,
        String tipo,
        String serieNumero,
        String nombreArchivo,
        EstadoSunat estado,
        String codigoRespuesta,
        String descripcion,
        String observaciones,
        String hash,
        BigDecimal total,
        Integer intentos,
        LocalDateTime enviadoEn,
        boolean tieneCdr
) {
    public static EnvioResponse from(EnvioSunat e) {
        return new EnvioResponse(e.getOrdenId(), e.getComprobanteId(), e.getTipo(), e.getSerieNumero(),
                e.getNombreArchivo(), e.getEstado(), e.getCodigoRespuesta(), e.getDescripcion(),
                e.getObservaciones(), e.getHash(), e.getTotal(), e.getIntentos(), e.getEnviadoEn(),
                e.getCdrZip() != null);
    }
}
