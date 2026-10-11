package com.sistema.polleria.inventory.repository;

import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MermaRepository extends JpaRepository<Merma, Long> {

    List<Merma> findByInsumoIdOrderByFechaDesc(Long insumoId);

    List<Merma> findByMotivoOrderByFechaDesc(MotivoMerma motivo);

    List<Merma> findByFechaBetweenOrderByFechaDesc(LocalDateTime desde, LocalDateTime hasta);

    List<Merma> findAllByOrderByFechaDesc();
}
