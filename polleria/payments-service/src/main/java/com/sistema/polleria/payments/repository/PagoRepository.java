package com.sistema.polleria.payments.repository;

import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PagoRepository extends JpaRepository<Pago, Long> {

    Optional<Pago> findByOrdenId(Long ordenId);

    List<Pago> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<Pago> findByEstadoOrderByCreadoEnDesc(EstadoPago estado);

    List<Pago> findAllByOrderByCreadoEnDesc();
}
