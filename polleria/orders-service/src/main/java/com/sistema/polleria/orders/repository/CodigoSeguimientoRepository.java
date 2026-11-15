package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.CodigoSeguimiento;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CodigoSeguimientoRepository extends JpaRepository<CodigoSeguimiento, Long> {

    Optional<CodigoSeguimiento> findTopByTelefonoOrderByCreadoEnDesc(String telefono);

    Optional<CodigoSeguimiento> findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc(String telefono);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM CodigoSeguimiento c WHERE c.telefono = :telefono AND c.usado = false ORDER BY c.creadoEn DESC")
    List<CodigoSeguimiento> findByTelefonoAndUsadoFalseWithLock(@Param("telefono") String telefono);

    long countByTelefonoAndCreadoEnAfter(String telefono, LocalDateTime desde);

    @Modifying
    @Query("UPDATE CodigoSeguimiento c SET c.usado = true WHERE c.telefono = :telefono AND c.usado = false")
    void invalidarAnteriores(@Param("telefono") String telefono);
}
