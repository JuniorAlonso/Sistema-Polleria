package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Next receipt number per type (D3.4). The transaction-scoped advisory lock serializes emissions of
 * the same type until commit, so two cashiers never read the same last number. Unlike a sequence it
 * leaves no gaps when an emission rolls back. Receipts are never deleted, so the maximum is stable.
 */
@Component
@RequiredArgsConstructor
public class GeneradorCorrelativo {

    /** Namespace of this service's advisory locks; the type ordinal keeps BOLETA and FACTURA apart. */
    private static final long BASE_CLAVE = 3_000L;

    private final JdbcTemplate jdbcTemplate;

    static long claveBloqueo(TipoComprobante tipo) {
        return BASE_CLAVE + tipo.ordinal();
    }

    static String prefijo(TipoComprobante tipo) {
        return tipo == TipoComprobante.FACTURA ? "F001-" : "B001-";
    }

    /** Must run inside the emission transaction: the lock is released on its commit or rollback. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String siguiente(TipoComprobante tipo) {
        jdbcTemplate.query("SELECT pg_advisory_xact_lock(?)", rs -> null, claveBloqueo(tipo));
        String prefijo = prefijo(tipo);
        Long ultimo = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(CAST(SUBSTRING(serie_correlativo FROM 6) AS BIGINT)), 0)"
                        + " FROM comprobantes_pago WHERE serie_correlativo LIKE ? || '%' AND tipo = ?",
                Long.class, prefijo, tipo.name());
        long siguiente = (ultimo == null ? 0L : ultimo) + 1;
        return String.format("%s%06d", prefijo, siguiente);
    }
}
