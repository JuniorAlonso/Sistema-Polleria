package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.OrdersServiceApplication;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.util.TimeZone;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The timestamps the frontend shows (listoAt, creadoEn, enPuertaAt) travel without a zone and the
 * browser reads them as Lima time. With the JVM in UTC (Docker, Cloud Run) every timer was 5 hours
 * off: a pickup order showed "360 min para recoger" instead of 60.
 */
class ZonaHorariaTest {

    private final TimeZone original = TimeZone.getDefault();

    @AfterEach
    void restaurar() {
        TimeZone.setDefault(original);
    }

    @Test
    void elServicioCorreEnHoraDeLimaAunqueElServidorEsteEnUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        OrdersServiceApplication.aplicarZonaHoraria();

        assertEquals("America/Lima", TimeZone.getDefault().getID());
        assertEquals(ZoneId.of("America/Lima"), ZoneId.systemDefault());
    }
}
