package com.sistema.polleria.feedback.repository;

import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReporteIncidenciaRepository extends JpaRepository<ReporteIncidencia, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("SELECT r FROM ReporteIncidencia r WHERE r.id = :id")
    Optional<ReporteIncidencia> buscarConBloqueo(@Param("id") Long id);

    List<ReporteIncidencia> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<ReporteIncidencia> findByEstadoOrderByCreadoEnDesc(EstadoReclamo estado);

    List<ReporteIncidencia> findByEstadoOrderByCreadoEnDesc(EstadoReclamo estado, Pageable pageable);

    List<ReporteIncidencia> findByMotivoOrderByCreadoEnDesc(MotivoReclamo motivo);

    List<ReporteIncidencia> findByMotivoOrderByCreadoEnDesc(MotivoReclamo motivo, Pageable pageable);

    List<ReporteIncidencia> findByEstadoAndMotivoOrderByCreadoEnDesc(EstadoReclamo estado, MotivoReclamo motivo);

    List<ReporteIncidencia> findByEstadoAndMotivoOrderByCreadoEnDesc(EstadoReclamo estado, MotivoReclamo motivo, Pageable pageable);

    Optional<ReporteIncidencia> findFirstByOrdenIdOrderByCreadoEnDesc(Long ordenId);

    List<ReporteIncidencia> findAllByOrderByCreadoEnDesc();

    List<ReporteIncidencia> findAllByOrderByCreadoEnDesc(Pageable pageable);

    boolean existsByOrdenId(Long ordenId);

    // Devoluciones en ventanilla pendientes de entrega (canal=VENTANILLA y devueltoEn=null)
    List<ReporteIncidencia> findByCanalDevolucionAndDevueltoEnIsNullOrderByCreadoEnDesc(String canalDevolucion);

    List<ReporteIncidencia> findByCanalDevolucionAndDevueltoEnIsNullOrderByCreadoEnDesc(String canalDevolucion, Pageable pageable);
}
