package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.EstadoLiquidacion;
import com.sistema.polleria.finance.entity.LiquidacionRepartidor;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LiquidacionRepartidorRepository extends JpaRepository<LiquidacionRepartidor, Long> {

    List<LiquidacionRepartidor> findByRepartidorIdOrderByCreadoEnDesc(Long repartidorId);

    Optional<LiquidacionRepartidor> findFirstByRepartidorIdAndEstado(Long repartidorId, EstadoLiquidacion estado);

    List<LiquidacionRepartidor> findByArqueoCajaIdOrderByCreadoEnDesc(Long arqueoCajaId);

    List<LiquidacionRepartidor> findByEstadoOrderByCreadoEnDesc(EstadoLiquidacion estado);

    /**
     * Row lock (SELECT ... FOR UPDATE) for closing a settlement: a second simultaneous close waits,
     * then sees it already closed, so the cash income is never registered twice (R3.9).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from LiquidacionRepartidor l where l.id = :id")
    Optional<LiquidacionRepartidor> findByIdParaActualizar(@Param("id") Long id);
}
