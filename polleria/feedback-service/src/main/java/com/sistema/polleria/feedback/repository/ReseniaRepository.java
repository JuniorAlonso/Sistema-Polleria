package com.sistema.polleria.feedback.repository;

import com.sistema.polleria.feedback.entity.Resenia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    List<Resenia> findByVisibleTrueOrderByCreadoEnDesc();

    List<Resenia> findByProductoIdAndVisibleTrueOrderByCreadoEnDesc(Long productoId);

    @Query("SELECT AVG(r.calificacion) FROM Resenia r WHERE r.visible = true")
    Double obtenerPromedioCalificacionGlobal();

    @Query("SELECT AVG(r.calificacion) FROM Resenia r WHERE r.productoId = :productoId AND r.visible = true")
    Double obtenerPromedioCalificacionProducto(@Param("productoId") Long productoId);

    @Query("SELECT COUNT(r) FROM Resenia r WHERE r.productoId = :productoId AND r.visible = true")
    Long contarPorProducto(@Param("productoId") Long productoId);
}
