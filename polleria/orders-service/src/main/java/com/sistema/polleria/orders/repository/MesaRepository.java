package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MesaRepository extends JpaRepository<Mesa, Long> {
    List<Mesa> findByEstado(MesaEstado estado);
    Optional<Mesa> findByNumero(Integer numero);
    boolean existsByNumero(Integer numero);
}
