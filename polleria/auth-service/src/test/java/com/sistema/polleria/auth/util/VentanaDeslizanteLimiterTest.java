package com.sistema.polleria.auth.util;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VentanaDeslizanteLimiterTest {

    @Test
    void bloqueaAlSuperarElLimiteYLiberaAlPasarLaVentana() {
        AtomicLong reloj = new AtomicLong(1_000);
        VentanaDeslizanteLimiter limiter = new VentanaDeslizanteLimiter(3, 60_000, reloj::get);

        assertTrue(limiter.permitir("1.1.1.1"));
        assertTrue(limiter.permitir("1.1.1.1"));
        assertTrue(limiter.permitir("1.1.1.1"));
        assertFalse(limiter.permitir("1.1.1.1"));
        assertTrue(limiter.permitir("2.2.2.2"), "other IPs have their own window");

        reloj.addAndGet(60_001);
        assertTrue(limiter.permitir("1.1.1.1"));
    }
}
