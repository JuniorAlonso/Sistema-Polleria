package com.sistema.polleria.auth.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TelefonoUtilTest {

    @Test
    void testNormalizarCelularPeruano() {
        assertEquals("987654321", TelefonoUtil.normalizar("987654321"));
        assertEquals("987654321", TelefonoUtil.normalizar("+51 987 654 321"));
        assertEquals("987654321", TelefonoUtil.normalizar("51987654321"));
        assertEquals("987654321", TelefonoUtil.normalizar("987-654-321"));
        assertNull(TelefonoUtil.normalizar("123456789")); // no empieza con 9
        assertNull(TelefonoUtil.normalizar(null));
    }

    @Test
    void testCanonicoCelularPeruano() {
        assertEquals("987654321", TelefonoUtil.canonico("+51 987 654 321"));
        assertEquals("987654321", TelefonoUtil.canonico("987654321"));
        assertEquals("987654321", TelefonoUtil.canonico("01987654321"));
        assertNull(TelefonoUtil.canonico(null));
        assertNull(TelefonoUtil.canonico("   "));
    }
}
