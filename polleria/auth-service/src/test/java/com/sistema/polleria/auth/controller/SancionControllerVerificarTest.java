package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.dto.VerificarSancionResponse;
import com.sistema.polleria.auth.service.SancionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SancionControllerVerificarTest {

    private final SancionService service = mock(SancionService.class);
    private final SancionController controller = new SancionController(service);

    SancionControllerVerificarTest() {
        ReflectionTestUtils.setField(controller, "internalApiKey", "secret");
        when(service.verificarSancion(any(), any(), any())).thenReturn(VerificarSancionResponse.sinSancion());
    }

    private MockHttpServletRequest desde(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("X-Forwarded-For", ip);
        return req;
    }

    @Test
    void devuelve429DespuesDe30PeticionesPorIpYUsaLaIpDeLaPeticion() {
        for (int i = 0; i < 30; i++) {
            assertEquals(HttpStatus.OK,
                    controller.verificarSancion("987654321", null, null, null, desde("9.9.9.9")).getStatusCode());
        }
        ResponseEntity<VerificarSancionResponse> limitada =
                controller.verificarSancion("987654321", null, null, null, desde("9.9.9.9"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, limitada.getStatusCode());
        verify(service, org.mockito.Mockito.atLeastOnce()).verificarSancion(eq("987654321"), eq(null), eq("9.9.9.9"));
        assertEquals(HttpStatus.OK,
                controller.verificarSancion("987654321", null, null, null, desde("8.8.8.8")).getStatusCode());
    }

    @Test
    void laLlamadaInternaNoSeLimita() {
        for (int i = 0; i < 40; i++) {
            assertEquals(HttpStatus.OK,
                    controller.verificarSancion(null, null, "1.2.3.4", "secret", desde("7.7.7.7")).getStatusCode());
        }
    }
}
