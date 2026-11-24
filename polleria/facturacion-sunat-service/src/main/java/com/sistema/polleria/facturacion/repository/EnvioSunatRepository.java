package com.sistema.polleria.facturacion.repository;

import com.sistema.polleria.facturacion.dto.EnvioResponse;
import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnvioSunatRepository extends JpaRepository<EnvioSunat, Long> {

    Optional<EnvioSunat> findByOrdenId(Long ordenId);

    @Query("""
            SELECT new com.sistema.polleria.facturacion.dto.EnvioResponse(
                e.ordenId, e.comprobanteId, e.tipo, e.serieNumero, e.nombreArchivo,
                e.estado, e.codigoRespuesta, e.descripcion, e.observaciones, e.hash,
                e.total, e.intentos, e.enviadoEn, (e.cdrZip IS NOT NULL)
            )
            FROM EnvioSunat e
            ORDER BY e.id DESC
            """)
    List<EnvioResponse> findResumenAll(Pageable pageable);

    @Query("""
            SELECT new com.sistema.polleria.facturacion.dto.EnvioResponse(
                e.ordenId, e.comprobanteId, e.tipo, e.serieNumero, e.nombreArchivo,
                e.estado, e.codigoRespuesta, e.descripcion, e.observaciones, e.hash,
                e.total, e.intentos, e.enviadoEn, (e.cdrZip IS NOT NULL)
            )
            FROM EnvioSunat e
            WHERE e.estado = :estado
            ORDER BY e.id DESC
            """)
    List<EnvioResponse> findResumenByEstado(@Param("estado") EstadoSunat estado, Pageable pageable);
}
