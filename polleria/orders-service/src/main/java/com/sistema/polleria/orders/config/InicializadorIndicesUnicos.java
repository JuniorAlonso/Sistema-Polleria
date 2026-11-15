package com.sistema.polleria.orders.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Red de seguridad en base de datos para invariantes del dominio, ejecutada en autocommit
 * para que una restricción que falle por datos heredados no aborte las siguientes sentencias.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesUnicos implements ApplicationRunner {

    private static final String DIGITOS = "regexp_replace(telefono_cliente, '\\D', '', 'g')";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        ampliarColumnaCodigoSeguimiento();
        normalizarTelefonosExistentes();
        crearIndice("uq_ordenes_numero_por_cliente",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_numero_por_cliente "
              + "ON ordenes (cliente_id, numero_cliente) "
              + "WHERE cliente_id IS NOT NULL AND cliente_id > 0 AND numero_cliente IS NOT NULL");
        crearIndice("uq_ordenes_numero_por_telefono",
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_numero_por_telefono "
              + "ON ordenes (telefono_normalizado, numero_cliente) "
              + "WHERE (cliente_id IS NULL OR cliente_id = 0) "
              + "AND telefono_normalizado IS NOT NULL AND numero_cliente IS NOT NULL");
    }

    private void ampliarColumnaCodigoSeguimiento() {
        try {
            jdbcTemplate.execute("ALTER TABLE codigos_seguimiento ALTER COLUMN codigo TYPE VARCHAR(6)");
        } catch (Exception e) {
            log.debug("Columna codigos_seguimiento.codigo sin cambios: {}", e.getMessage());
        }
    }

    private void normalizarTelefonosExistentes() {
        try {
            int filas = jdbcTemplate.update(
                    "UPDATE ordenes SET telefono_normalizado = RIGHT(" + DIGITOS + ", 9) "
                  + "WHERE telefono_cliente IS NOT NULL AND telefono_normalizado IS NULL "
                  + "AND length(" + DIGITOS + ") >= 9");
            if (filas > 0) {
                log.info("Teléfono normalizado en {} orden(es) existentes", filas);
            }
        } catch (Exception e) {
            log.warn("No se pudieron normalizar teléfonos existentes: {}", e.getMessage());
        }
    }

    private void crearIndice(String nombre, String ddl) {
        try {
            jdbcTemplate.execute(ddl);
            log.info("Índice único {} verificado", nombre);
        } catch (Exception e) {
            log.warn("No se pudo crear el índice único {}: {}. Revise si hay datos heredados "
                   + "que lo violan antes de reintentar.", nombre, e.getMessage());
        }
    }
}
