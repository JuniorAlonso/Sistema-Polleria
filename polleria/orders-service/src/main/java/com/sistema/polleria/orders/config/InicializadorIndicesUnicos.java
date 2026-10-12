package com.sistema.polleria.orders.config;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Red de seguridad en base de datos para dos invariantes del dominio:
 *
 * 1. El celular queda en forma canónica en {@code telefono_normalizado}, para que el índice
 *    único de numeración reconozca al mismo cliente aunque el número se haya escrito con
 *    formatos distintos.
 * 2. El número de pedido del cliente no puede repetirse para el mismo cliente (o el mismo
 *    celular). El contador con bloqueo pesimista ya lo garantiza desde la aplicación; estos
 *    índices hacen que, si esa lógica fallara, la base rechace el duplicado en lugar de
 *    aceptarlo en silencio.
 *
 * Corre después de {@link InicializadorVersiones} y antes de {@code DataInitializer}.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
@RequiredArgsConstructor
public class InicializadorIndicesUnicos implements ApplicationRunner {

    private static final String DIGITOS = "regexp_replace(telefono_cliente, '\\D', '', 'g')";

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
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

    private void normalizarTelefonosExistentes() {
        int filas = entityManager.createNativeQuery(
                "UPDATE ordenes SET telefono_normalizado = RIGHT(" + DIGITOS + ", 9) "
              + "WHERE telefono_cliente IS NOT NULL AND telefono_normalizado IS NULL "
              + "AND length(" + DIGITOS + ") >= 9")
                .executeUpdate();
        if (filas > 0) {
            log.info("Teléfono normalizado en {} orden(es) existentes", filas);
        }
    }

    /**
     * No se aborta el arranque si hay datos heredados que violan el índice: se registra el
     * motivo para que sea visible y la aplicación sigue funcionando con el contador como
     * defensa principal. Abortar aquí dejaría el servicio en bucle de reinicio, que es peor
     * que un índice ausente con aviso explícito.
     */
    private void crearIndice(String nombre, String ddl) {
        try {
            entityManager.createNativeQuery(ddl).executeUpdate();
            log.info("Índice único {} verificado", nombre);
        } catch (Exception e) {
            log.warn("No se pudo crear el índice único {}: {}. Revise si hay datos heredados "
                   + "que lo violan antes de reintentar.", nombre, e.getMessage());
        }
    }
}
