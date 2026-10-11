package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ArqueoCajaRepository extends JpaRepository<ArqueoCaja, Long> {

    Optional<ArqueoCaja> findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja estado);

    Optional<ArqueoCaja> findFirstByUsuarioIdAndEstadoOrderByFechaAperturaDesc(Long usuarioId, EstadoCaja estado);

    List<ArqueoCaja> findByFechaAperturaBetweenOrderByFechaAperturaDesc(LocalDateTime desde, LocalDateTime hasta);

    List<ArqueoCaja> findAllByOrderByFechaAperturaDesc();
}
