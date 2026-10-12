package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.CodigoSeguimiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CodigoSeguimientoRepository extends JpaRepository<CodigoSeguimiento, Long> {

    Optional<CodigoSeguimiento> findTopByTelefonoOrderByCreadoEnDesc(String telefono);

    Optional<CodigoSeguimiento> findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc(String telefono);

    @Modifying
    @Query("UPDATE CodigoSeguimiento c SET c.usado = true WHERE c.telefono = :telefono AND c.usado = false")
    void invalidarAnteriores(@Param("telefono") String telefono);
}
