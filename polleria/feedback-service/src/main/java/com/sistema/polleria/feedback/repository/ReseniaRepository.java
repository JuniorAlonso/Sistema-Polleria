package com.sistema.polleria.feedback.repository;

import com.sistema.polleria.feedback.entity.Resenia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReseniaRepository extends JpaRepository<Resenia, Long> {

    List<Resenia> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<Resenia> findByOrdenId(Long ordenId);

    Optional<Resenia> findByOrdenIdAndClienteId(Long ordenId, Long clienteId);

    boolean existsByOrdenIdAndClienteId(Long ordenId, Long clienteId);

    List<Resenia> findAllByOrderByCreadoEnDesc();

    @Query("SELECT AVG(r.calificacion) FROM Resenia r")
    Double obtenerPromedioCalificacionGlobal();
}
