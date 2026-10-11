package com.sistema.polleria.inventory.repository;

import com.sistema.polleria.inventory.entity.DespachoCocina;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface DespachoCocinaRepository extends JpaRepository<DespachoCocina, Long> {

    List<DespachoCocina> findBySolicitanteIdOrderByFechaDespachoDesc(Long solicitanteId);

    List<DespachoCocina> findByFechaDespachoBetweenOrderByFechaDespachoDesc(LocalDateTime desde, LocalDateTime hasta);

    List<DespachoCocina> findAllByOrderByFechaDespachoDesc();
}
