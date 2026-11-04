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

import java.util.List;

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

        when(sancionClienteRepository.buscarCoincidencias(eq("987654321"), any(), any()))
                .thenReturn(List.of(s));

        VerificarSancionResponse res = sancionService.verificarSancion("+51 987 654 321", null, null);

        assertTrue(res.sancionado());
        assertTrue(res.bloqueadoEfectivo());
        assertFalse(res.bloqueadoTotal());
    }

    @Test
    void testRegistrarSancionFusionaConExistenteSinDuplicar() {
        SancionCliente existente = SancionCliente.builder()
                .id(7L).telefonoNormalizado("987654321").motivo("PEDIDO_FANTASMA").bloqueadoEfectivo(true).build();
        when(sancionClienteRepository.buscarCoincidencias(eq("987654321"), eq("nuevo@test.com"), eq("10.0.0.1")))
                .thenReturn(List.of(existente));
        when(sancionClienteRepository.save(any(SancionCliente.class))).thenAnswer(inv -> inv.getArgument(0));

        SancionCliente s = sancionService.registrarSancion(new CrearSancionRequest(
                "987654321", " Nuevo@Test.com ", "10.0.0.1", "otro motivo", 5L, true, null), "TEST");

        assertSame(existente, s);
        assertEquals("nuevo@test.com", s.getEmail());
        assertEquals("10.0.0.1", s.getIpAddress());
        assertEquals("PEDIDO_FANTASMA", s.getMotivo());
        verify(sancionClienteRepository, times(1)).save(existente);
    }

    @Test
    void testVerificarCoincideConEmailSinImportarMayusculas() {
        SancionCliente s = SancionCliente.builder().id(3L).email("sancionado@test.com").bloqueadoEfectivo(true).build();
        when(sancionClienteRepository.buscarCoincidencias(isNull(), eq("sancionado@test.com"), isNull()))
                .thenReturn(List.of(s));

        VerificarSancionResponse res = sancionService.verificarSancion(null, "  SANCIONADO@Test.com ", null);

        assertTrue(res.sancionado());
        assertTrue(res.bloqueadoEfectivo());
    }

    @Test
    void testVerificarSinIdentificadoresNoConsultaYNoBloquea() {
        VerificarSancionResponse res = sancionService.verificarSancion(null, " ", "");

        assertFalse(res.sancionado());
        verifyNoInteractions(sancionClienteRepository);
    }

    @Test
    void testVerificarSancionInexistenteDevuelveSinSancion() {
        when(sancionClienteRepository.buscarCoincidencias(any(), any(), any()))
                .thenReturn(List.of());

        VerificarSancionResponse res = sancionService.verificarSancion("911222333", "limpio@test.com", "127.0.0.1");

        assertFalse(res.sancionado());
        assertFalse(res.bloqueadoEfectivo());
    }
}
