package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductoRepository extends JpaRepository<Producto, Long> {
    List<Producto> findByDisponibleTrue();
    List<Producto> findByCategoria(Categoria categoria);
    List<Producto> findByCategoriaAndDisponibleTrue(Categoria categoria);
}
