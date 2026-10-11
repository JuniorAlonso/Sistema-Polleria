package com.sistema.polleria.inventory.repository;

import com.sistema.polleria.inventory.entity.Insumo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InsumoRepository extends JpaRepository<Insumo, Long> {

    Optional<Insumo> findByNombre(String nombre);

    boolean existsByNombre(String nombre);

    // Insumos con stock crítico menor o igual al umbral de alerta
    @Query("SELECT i FROM Insumo i WHERE i.stockActual <= i.stockMinimoAlerta")
    List<Insumo> findCriticos();
}
