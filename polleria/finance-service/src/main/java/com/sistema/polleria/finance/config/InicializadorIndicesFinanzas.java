package com.sistema.polleria.finance.config;

import com.sistema.polleria.finance.entity.CategoriaMovimiento;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.EstadoLiquidacion;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Aligns unique indexes, nullable backfill columns and enum CHECK constraints at startup.
 * Each statement runs on its own auto-committed connection; CHECK constraints are only rebuilt
 * atomically when pg_constraint is missing or lags behind the Java enum values.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesFinanzas implements ApplicationRunner {

    private record Indice(String nombre, String sql, String causaProbable) {
    }

    private record EnumCheck(String tabla, String constraint, boolean nullable, Class<? extends Enum<?>> enumClass) {
    }

    private static final List<String> BACKFILLS = List.of(
            "UPDATE arqueos_caja SET version = 0 WHERE version IS NULL",
            "UPDATE liquidaciones_repartidores SET version = 0 WHERE version IS NULL",
            "UPDATE comprobantes_pago SET version = 0 WHERE version IS NULL",
            "UPDATE comprobantes_pago SET anulado = false WHERE anulado IS NULL");

    private static final List<Indice> INDICES = List.of(
            new Indice("uq_comprobantes_orden_id",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobantes_orden_id ON comprobantes_pago (orden_id)",
                    "órdenes con más de un comprobante"),
            new Indice("uq_arqueos_caja_abierta",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_arqueos_caja_abierta ON arqueos_caja (estado)"
                            + " WHERE estado = 'ABIERTA'",
                    "más de una caja en estado ABIERTA"),
            new Indice("uq_liquidacion_abierta_repartidor",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_liquidacion_abierta_repartidor"
                            + " ON liquidaciones_repartidores (repartidor_id) WHERE estado = 'ABIERTA'",
                    "repartidores con más de una liquidación ABIERTA"),
            new Indice("uq_movimientos_ingreso_orden",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_ingreso_orden ON movimientos_caja (orden_id)"
                            + " WHERE orden_id IS NOT NULL AND tipo = 'INGRESO'",
                    "órdenes con más de un INGRESO de venta"),
            new Indice("uq_movimientos_devolucion_reclamo",
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_movimientos_devolucion_reclamo ON movimientos_caja (reclamo_id)"
                            + " WHERE categoria = 'DEVOLUCION'",
                    "reclamos con más de una devolución en caja"));

    private static final List<EnumCheck> ENUM_CHECKS = List.of(
            new EnumCheck("movimientos_caja", "movimientos_caja_categoria_check", true, CategoriaMovimiento.class),
            new EnumCheck("movimientos_caja", "movimientos_caja_tipo_check", false, TipoMovimiento.class),
            new EnumCheck("arqueos_caja", "arqueos_caja_estado_check", false, EstadoCaja.class),
            new EnumCheck("liquidaciones_repartidores", "liquidaciones_repartidores_estado_check", false, EstadoLiquidacion.class),
            new EnumCheck("comprobantes_pago", "comprobantes_pago_tipo_check", false, TipoComprobante.class));

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (String sql : BACKFILLS) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception e) {
                log.warn("No se pudo ejecutar backfill ({}): {}", sql, e.getMessage());
            }
        }
        for (Indice indice : INDICES) {
            try {
                jdbcTemplate.execute(indice.sql());
                log.info("Índice único {} verificado", indice.nombre());
            } catch (Exception e) {
                log.error("No se pudo crear el índice único {}: {}. Revise si hay {} antes de reiniciar.",
                        indice.nombre(), e.getMessage(), indice.causaProbable());
            }
        }
        for (EnumCheck check : ENUM_CHECKS) {
            alinearEnumCheck(check);
        }
    }

    private void alinearEnumCheck(EnumCheck check) {
        try {
            Enum<?>[] constantes = check.enumClass().getEnumConstants();
            List<String> defs = jdbcTemplate.query(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = to_regclass(?) AND conname = ? AND contype = 'c'",
                    (rs, rowNum) -> rs.getString(1),
                    check.tabla(), check.constraint());
            if (!defs.isEmpty() && contieneTodos(defs.get(0), check.nullable(), check.constraint(), constantes)) {
                return;
            }
            String valoresSql = Arrays.stream(constantes)
                    .map(c -> "'" + c.name() + "'")
                    .collect(Collectors.joining(", "));
            String col = columna(check.constraint(), check.tabla());
            String condicion = (check.nullable() ? col + " IS NULL OR " : "") + col + " IN (" + valoresSql + ")";
            String sql = "ALTER TABLE " + check.tabla()
                    + " DROP CONSTRAINT IF EXISTS " + check.constraint()
                    + ", ADD CONSTRAINT " + check.constraint() + " CHECK (" + condicion + ")";
            jdbcTemplate.execute(sql);
            log.info("Constraint CHECK {} alineado en {}", check.constraint(), check.tabla());
        } catch (Exception e) {
            log.error("No se pudo alinear el CHECK {} en {}: {}", check.constraint(), check.tabla(), e.getMessage());
        }
    }

    private static boolean contieneTodos(String def, boolean nullable, String constraint, Enum<?>[] constantes) {
        if (def == null) {
            return false;
        }
        if (nullable && !def.toUpperCase().contains("IS NULL")) {
            return false;
        }
        for (Enum<?> c : constantes) {
            if (!def.contains("'" + c.name() + "'")) {
                return false;
            }
        }
        return true;
    }

    private static String columna(String constraint, String tabla) {
        String prefijo = tabla + "_";
        String sinPrefijo = constraint.startsWith(prefijo) ? constraint.substring(prefijo.length()) : constraint;
        return sinPrefijo.endsWith("_check") ? sinPrefijo.substring(0, sinPrefijo.length() - "_check".length()) : sinPrefijo;
    }
}
