package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.CanalOrigen;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
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
 * Synchronizes every enum CHECK constraint in orders-service atomically when any enum value is
 * missing, avoiding table rewrites on healthy schemas and eliminating partial DROP+ADD windows.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorEstadoOrdenCheck implements ApplicationRunner {

    static final String CONSTRAINT = "ordenes_estado_check";

    private record EnumCheckSpec(String tabla, String columna, String constraint, Enum<?>[] valores, boolean nullable) {}

    private static final List<EnumCheckSpec> SPECS = List.of(
            new EnumCheckSpec("ordenes", "estado", "ordenes_estado_check", OrdenEstado.values(), false),
            new EnumCheckSpec("ordenes", "tipo", "ordenes_tipo_check", OrdenTipo.values(), false),
            new EnumCheckSpec("ordenes", "canal_origen", "ordenes_canal_origen_check", CanalOrigen.values(), true),
            new EnumCheckSpec("mesas", "estado", "mesas_estado_check", MesaEstado.values(), false),
            new EnumCheckSpec("productos", "categoria", "productos_categoria_check", Categoria.values(), false)
    );

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        for (EnumCheckSpec spec : SPECS) {
            sincronizarCheck(spec);
        }
    }

    private void sincronizarCheck(EnumCheckSpec spec) {
        try {
            if (contieneTodos(definicionActual(spec.tabla(), spec.constraint()), spec.valores())) {
                log.debug("Constraint {} ya acepta todos los valores; no se reconstruye", spec.constraint());
                return;
            }
            String valoresSql = Arrays.stream(spec.valores())
                    .map(v -> "'" + v.name() + "'")
                    .collect(Collectors.joining(","));
            String predicado = spec.nullable()
                    ? spec.columna() + " IS NULL OR " + spec.columna() + " IN (" + valoresSql + ")"
                    : spec.columna() + " IN (" + valoresSql + ")";
            jdbcTemplate.execute("ALTER TABLE " + spec.tabla()
                    + " DROP CONSTRAINT IF EXISTS " + spec.constraint()
                    + ", ADD CONSTRAINT " + spec.constraint() + " CHECK (" + predicado + ")");
            log.info("Constraint {} sincronizado ({} valores)", spec.constraint(), spec.valores().length);
        } catch (Exception e) {
            log.error("No se pudo sincronizar el constraint {}: {}", spec.constraint(), e.getMessage(), e);
        }
    }

    private String definicionActual(String tabla, String constraint) {
        List<String> definiciones = jdbcTemplate.queryForList(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                        + "WHERE conrelid = ?::regclass AND conname = ?",
                String.class, tabla, constraint);
        return definiciones.isEmpty() ? null : definiciones.get(0);
    }

    private static boolean contieneTodos(String definicion, Enum<?>[] valores) {
        return definicion != null && Arrays.stream(valores)
                .allMatch(v -> definicion.contains("'" + v.name() + "'"));
    }
}
