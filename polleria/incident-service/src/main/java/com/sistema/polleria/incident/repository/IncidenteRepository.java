package com.sistema.polleria.incident.repository;

import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Incidente;
import com.sistema.polleria.incident.entity.Severidad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidenteRepository extends JpaRepository<Incidente, Long> {

    List<Incidente> findBySeveridadOrderByOcurridoEnDesc(Severidad severidad);

    List<Incidente> findByEstadoOrderByOcurridoEnDesc(EstadoIncidente estado);

    List<Incidente> findBySeveridadAndEstadoOrderByOcurridoEnDesc(Severidad severidad, EstadoIncidente estado);

    List<Incidente> findAllByOrderByOcurridoEnDesc();
}
