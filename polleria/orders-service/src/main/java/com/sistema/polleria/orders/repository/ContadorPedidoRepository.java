package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.ContadorPedido;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ContadorPedidoRepository extends JpaRepository<ContadorPedido, String> {

    /**
     * Crea la fila del contador si no existe, sin fallar si otro mozo la creó antes.
     * Debe ejecutarse dentro de una transacción.
     */
    @Modifying
    @Query(value = "INSERT INTO contador_pedido (clave, ultimo) VALUES (:clave, 0) "
                 + "ON CONFLICT (clave) DO NOTHING", nativeQuery = true)
    void crearSiNoExiste(@Param("clave") String clave);

    /**
     * Lee el contador tomando un bloqueo pesimista de escritura (SELECT ... FOR UPDATE).
     * Los mozos que atienden al mismo cliente se serializan aquí hasta que la transacción
     * del primero confirma, garantizando números distintos.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ContadorPedido c WHERE c.clave = :clave")
    Optional<ContadorPedido> buscarConBloqueo(@Param("clave") String clave);
}
