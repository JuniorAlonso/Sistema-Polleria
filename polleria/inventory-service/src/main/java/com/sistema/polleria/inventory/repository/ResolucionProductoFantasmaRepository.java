package com.sistema.polleria.inventory.repository;

import com.sistema.polleria.inventory.entity.ResolucionProductoFantasma;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ResolucionProductoFantasmaRepository extends JpaRepository<ResolucionProductoFantasma, Long> {

    Optional<ResolucionProductoFantasma> findByOrdenId(Long ordenId);
}
