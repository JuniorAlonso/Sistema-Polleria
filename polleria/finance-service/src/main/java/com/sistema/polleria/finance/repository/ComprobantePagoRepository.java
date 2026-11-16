package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ComprobantePagoRepository extends JpaRepository<ComprobantePago, Long> {

    Optional<ComprobantePago> findByOrdenId(Long ordenId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ComprobantePago c where c.ordenId = :ordenId")
    Optional<ComprobantePago> findByOrdenIdParaActualizar(@Param("ordenId") Long ordenId);

    /** Receipts issued in a time window: the daily report counts orders and sales from them. */
    List<ComprobantePago> findByEmitidoEnBetween(java.time.LocalDateTime inicio, java.time.LocalDateTime fin);

    List<ComprobantePago> findAllByOrderByEmitidoEnDesc(Pageable pageable);

    @Query("SELECT COUNT(c) FROM ComprobantePago c WHERE c.tipo = :tipo")
    long contarPorTipo(@Param("tipo") TipoComprobante tipo);
}
