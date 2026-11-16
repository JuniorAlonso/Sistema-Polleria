package com.sistema.polleria.payments.repository;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PagoRepository extends JpaRepository<Pago, Long> {

    Optional<Pago> findByOrdenId(Long ordenId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pago p WHERE p.ordenId = :ordenId")
    Optional<Pago> buscarPorOrdenIdConBloqueo(@Param("ordenId") Long ordenId);

    List<Pago> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<Pago> findByEstadoOrderByCreadoEnDesc(EstadoPago estado);

    List<Pago> findByEstadoOrderByCreadoEnDesc(EstadoPago estado, Pageable pageable);

    List<Pago> findAllByOrderByCreadoEnDesc();

    List<Pago> findAllByOrderByCreadoEnDesc(Pageable pageable);

    List<Pago> findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDesc(
            LocalDateTime desde, LocalDateTime hasta);

    List<Pago> findByEstadoAndCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDesc(
            EstadoPago estado, LocalDateTime desde, LocalDateTime hasta);

    Optional<Pago> findByReembolsoIdempotencyKey(String reembolsoIdempotencyKey);

    /**
     * Lee el pago tomando un bloqueo pesimista de escritura (SELECT ... FOR UPDATE).
     * Mercado Pago reintenta sus webhooks y puede entregar dos a la vez para el mismo pago:
     * sin este bloqueo ambos leían "no aprobado" y confirmaban dos veces (doble notificación
     * de la orden y doble WhatsApp al cliente).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pago p WHERE p.id = :id")
    Optional<Pago> buscarConBloqueo(@Param("id") Long id);

    /** Cash-on-delivery payments collected by a courier that no settlement has claimed yet, including refunded ones to net correctly. */
    @Query("SELECT p FROM Pago p WHERE p.repartidorId = :repartidorId"
            + " AND p.metodoPago = com.sistema.polleria.payments.entity.MetodoPago.CONTRAENTREGA"
            + " AND p.estado IN (com.sistema.polleria.payments.entity.EstadoPago.APROBADO,"
            + " com.sistema.polleria.payments.entity.EstadoPago.REEMBOLSADO_PARCIAL,"
            + " com.sistema.polleria.payments.entity.EstadoPago.REEMBOLSADO)"
            + " AND p.liquidacionId IS NULL AND p.verificadoEn >= :desde ORDER BY p.verificadoEn")
    List<Pago> efectivoPendienteDeRepartidor(@Param("repartidorId") Long repartidorId,
                                             @Param("desde") LocalDateTime desde);
}
