package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MesaRepository extends JpaRepository<Mesa, Long> {
    List<Mesa> findByActivoTrueOrderByNumeroAsc();
    List<Mesa> findByEstadoAndActivoTrue(MesaEstado estado);
    List<Mesa> findByEstado(MesaEstado estado);
    Optional<Mesa> findByNumero(Integer numero);
    boolean existsByNumero(Integer numero);
    boolean existsByNumeroAndIdNot(Integer numero, Long id);

    /**
     * Lee la mesa tomando un bloqueo pesimista de escritura (SELECT ... FOR UPDATE).
     * Serializa a los mozos que intentan abrir una comanda en la misma mesa al mismo
     * tiempo, de modo que la verificación "la mesa ya tiene comanda activa" y la
     * creación de la orden sean una sola operación atómica.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Mesa m WHERE m.id = :id")
    Optional<Mesa> buscarConBloqueo(@Param("id") Long id);
}
