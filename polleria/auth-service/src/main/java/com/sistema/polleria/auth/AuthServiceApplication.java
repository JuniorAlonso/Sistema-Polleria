package com.sistema.polleria.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AuthServiceApplication {
    /** Peru time for the whole service; the frontend reads timestamps without a zone as Lima time. */
    public static final String ZONA_HORARIA = "America/Lima";

    public static void main(String[] args) {
        aplicarZonaHoraria();
        SpringApplication.run(AuthServiceApplication.class, args);
    }

    /**
     * Docker and Cloud Run run the JVM in UTC. Timestamps such as listoAt or creadoEn travel without
     * a zone and the browser reads them as Lima time, so in UTC every timer on screen was 5 hours
     * off. Set before Spring starts so every LocalDateTime.now() is Lima time.
     */
    public static void aplicarZonaHoraria() {
        java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(ZONA_HORARIA));
    }
}
