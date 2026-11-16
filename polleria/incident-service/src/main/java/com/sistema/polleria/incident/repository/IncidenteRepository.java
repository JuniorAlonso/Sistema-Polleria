package com.sistema.polleria.incident.repository;

import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Incidente;
import com.sistema.polleria.incident.entity.Severidad;
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
public interface IncidenteRepository extends JpaRepository<Incidente, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("SELECT i FROM Incidente i WHERE i.id = :id")
    Optional<Incidente> buscarConBloqueo(@Param("id") Long id);

    List<Incidente> findBySeveridadOrderByOcurridoEnDesc(Severidad severidad);

    List<Incidente> findBySeveridadOrderByOcurridoEnDesc(Severidad severidad, Pageable pageable);

    List<Incidente> findByEstadoOrderByOcurridoEnDesc(EstadoIncidente estado);

    List<Incidente> findByEstadoOrderByOcurridoEnDesc(EstadoIncidente estado, Pageable pageable);

    List<Incidente> findBySeveridadAndEstadoOrderByOcurridoEnDesc(Severidad severidad, EstadoIncidente estado);

    List<Incidente> findBySeveridadAndEstadoOrderByOcurridoEnDesc(Severidad severidad, EstadoIncidente estado, Pageable pageable);

    List<Incidente> findAllByOrderByOcurridoEnDesc();

    List<Incidente> findAllByOrderByOcurridoEnDesc(Pageable pageable);
}
