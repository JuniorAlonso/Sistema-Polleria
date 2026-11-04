package com.sistema.polleria.finance.repository;

import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ComprobantePagoRepository extends JpaRepository<ComprobantePago, Long> {

    Optional<ComprobantePago> findByOrdenId(Long ordenId);

    @Query("SELECT COUNT(c) FROM ComprobantePago c WHERE c.tipo = :tipo")
    long contarPorTipo(@Param("tipo") TipoComprobante tipo);
}
