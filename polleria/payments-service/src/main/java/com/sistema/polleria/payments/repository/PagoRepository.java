package com.sistema.polleria.payments.repository;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PagoRepository extends JpaRepository<Pago, Long> {

    Optional<Pago> findByOrdenId(Long ordenId);

    List<Pago> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<Pago> findByEstadoOrderByCreadoEnDesc(EstadoPago estado);

    List<Pago> findAllByOrderByCreadoEnDesc();

    /**
     * Lee el pago tomando un bloqueo pesimista de escritura (SELECT ... FOR UPDATE).
     * Mercado Pago reintenta sus webhooks y puede entregar dos a la vez para el mismo pago:
     * sin este bloqueo ambos leían "no aprobado" y confirmaban dos veces (doble notificación
     * de la orden y doble WhatsApp al cliente).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pago p WHERE p.id = :id")
    Optional<Pago> buscarConBloqueo(@Param("id") Long id);
}
