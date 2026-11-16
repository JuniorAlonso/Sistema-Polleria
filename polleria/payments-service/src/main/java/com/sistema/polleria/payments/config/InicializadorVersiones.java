package com.sistema.polleria.payments.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
@RequiredArgsConstructor
public class InicializadorVersiones implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) {
        try {
            int pagos = jdbc.update("UPDATE pagos SET version = 0 WHERE version IS NULL");
            if (pagos > 0) {
                log.info("Versiones en NULL normalizadas a 0 — pagos: {}", pagos);
            }
        } catch (Exception e) {
            log.warn("No se pudo normalizar version en pagos: {}", e.getMessage());
        }
    }
}
