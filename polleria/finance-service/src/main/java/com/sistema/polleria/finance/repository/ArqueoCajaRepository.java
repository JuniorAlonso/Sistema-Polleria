package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.EstadoCaja;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ArqueoCajaRepository extends JpaRepository<ArqueoCaja, Long> {

    Optional<ArqueoCaja> findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja estado);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ArqueoCaja> findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja estado);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ArqueoCaja a where a.id = :id")
    Optional<ArqueoCaja> findByIdParaActualizar(@Param("id") Long id);

    Optional<ArqueoCaja> findFirstByUsuarioIdAndEstadoOrderByFechaAperturaDesc(Long usuarioId, EstadoCaja estado);

    List<ArqueoCaja> findByFechaAperturaBetweenOrderByFechaAperturaDesc(LocalDateTime desde, LocalDateTime hasta);

    List<ArqueoCaja> findAllByOrderByFechaAperturaDesc();

    List<ArqueoCaja> findAllByOrderByFechaAperturaDesc(Pageable pageable);
}
