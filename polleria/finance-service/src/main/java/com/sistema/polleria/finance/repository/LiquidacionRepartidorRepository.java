package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.EstadoLiquidacion;
import com.sistema.polleria.finance.entity.LiquidacionRepartidor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LiquidacionRepartidorRepository extends JpaRepository<LiquidacionRepartidor, Long> {

    List<LiquidacionRepartidor> findByRepartidorIdOrderByCreadoEnDesc(Long repartidorId);

    Optional<LiquidacionRepartidor> findFirstByRepartidorIdAndEstado(Long repartidorId, EstadoLiquidacion estado);

    List<LiquidacionRepartidor> findByArqueoCajaIdOrderByCreadoEnDesc(Long arqueoCajaId);

    List<LiquidacionRepartidor> findByEstadoOrderByCreadoEnDesc(EstadoLiquidacion estado);
}
