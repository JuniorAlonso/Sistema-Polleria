package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Producto;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
    List<Producto> findByDisponibleTrue();
    List<Producto> findByCategoria(Categoria categoria);
    List<Producto> findByCategoriaAndDisponibleTrue(Categoria categoria);

    /** Bloqueo pesimista: dos pedidos simultáneos no pueden vender la misma última unidad. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Producto p WHERE p.id = :id")
    Optional<Producto> findByIdConBloqueo(@Param("id") Long id);
}
