package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.CrearSancionRequest;
import com.sistema.polleria.auth.dto.VerificarSancionResponse;
import com.sistema.polleria.auth.entity.SancionCliente;
import com.sistema.polleria.auth.repository.SancionClienteRepository;
import com.sistema.polleria.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SancionServiceTest {

    @Mock
    private SancionClienteRepository sancionClienteRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SancionService sancionService;

    @Test
    void testRegistrarSancionNormalizaTelefonoYGuarda() {
        CrearSancionRequest req = new CrearSancionRequest(
                "+51 987 654 321", "cliente@test.com", "192.168.1.50",
                "PEDIDO_FANTASMA: No atendió en puerta", 101L, true, false);

        when(sancionClienteRepository.save(any(SancionCliente.class))).thenAnswer(inv -> {
            SancionCliente s = inv.getArgument(0);
            s.setId(1L);
            return s;
        });

        SancionCliente s = sancionService.registrarSancion(req, "TEST_SYSTEM");

        assertNotNull(s);
        assertEquals("987654321", s.getTelefonoNormalizado());
        assertEquals("cliente@test.com", s.getEmail());
        assertTrue(s.isBloqueadoEfectivo());
        verify(sancionClienteRepository).save(any(SancionCliente.class));
    }

    @Test
    void testVerificarSancionActivaDevuelveBloqueoEfectivo() {
        SancionCliente s = SancionCliente.builder()
                .id(2L)
                .telefonoNormalizado("987654321")
                .email("sancionado@test.com")
                .ipAddress("192.168.1.99")
                .motivo("PEDIDO_FANTASMA")
                .bloqueadoEfectivo(true)
                .bloqueadoTotal(false)
                .build();

        when(sancionClienteRepository.buscarSancionActiva(eq("987654321"), any(), any()))
                .thenReturn(Optional.of(s));

        VerificarSancionResponse res = sancionService.verificarSancion("+51 987 654 321", null, null);

        assertTrue(res.sancionado());
        assertTrue(res.bloqueadoEfectivo());
        assertFalse(res.bloqueadoTotal());
        assertEquals("PEDIDO_FANTASMA", res.motivo());
    }

    @Test
    void testVerificarSancionInexistenteDevuelveSinSancion() {
        when(sancionClienteRepository.buscarSancionActiva(any(), any(), any()))
                .thenReturn(Optional.empty());

        VerificarSancionResponse res = sancionService.verificarSancion("911222333", "limpio@test.com", "127.0.0.1");

        assertFalse(res.sancionado());
        assertFalse(res.bloqueadoEfectivo());
    }
}
