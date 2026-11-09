package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.CobroRepartidor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface CobroRepartidorRepository extends JpaRepository<CobroRepartidor, Long> {

    List<CobroRepartidor> findByRepartidorIdOrderByFechaDesc(Long repartidorId);

    List<CobroRepartidor> findByLiquidacionIdOrderByFechaDesc(Long liquidacionId);

    @Query("SELECT COALESCE(SUM(c.monto), 0) FROM CobroRepartidor c WHERE c.repartidorId = :repartidorId AND ((:liquidacionId IS NULL AND c.liquidacionId IS NULL) OR c.liquidacionId = :liquidacionId)")
    BigDecimal sumMontoByRepartidorIdAndLiquidacionId(@Param("repartidorId") Long repartidorId,
                                                      @Param("liquidacionId") Long liquidacionId);

    @Query("SELECT COALESCE(SUM(c.monto), 0) FROM CobroRepartidor c WHERE c.liquidacionId = :liquidacionId")
    BigDecimal sumMontoByLiquidacionId(@Param("liquidacionId") Long liquidacionId);
}

