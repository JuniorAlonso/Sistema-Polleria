package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Long> {

    List<MovimientoCaja> findByArqueoIdOrderByFechaDesc(Long arqueoId);

    List<MovimientoCaja> findByFechaBetweenOrderByFechaDesc(LocalDateTime desde, LocalDateTime hasta);

    List<MovimientoCaja> findByArqueoIdAndTipo(Long arqueoId, TipoMovimiento tipo);
}
