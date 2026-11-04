package com.sistema.polleria.feedback.repository;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReporteIncidenciaRepository extends JpaRepository<ReporteIncidencia, Long> {

    List<ReporteIncidencia> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<ReporteIncidencia> findByEstadoOrderByCreadoEnDesc(EstadoReclamo estado);

    List<ReporteIncidencia> findByMotivoOrderByCreadoEnDesc(MotivoReclamo motivo);

    List<ReporteIncidencia> findByEstadoAndMotivoOrderByCreadoEnDesc(EstadoReclamo estado, MotivoReclamo motivo);

    java.util.Optional<ReporteIncidencia> findFirstByOrdenIdOrderByCreadoEnDesc(Long ordenId);

    List<ReporteIncidencia> findAllByOrderByCreadoEnDesc();
}
