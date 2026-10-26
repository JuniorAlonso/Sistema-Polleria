package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ComprobanteServiceTest {

    @Mock
    private ComprobantePagoRepository comprobanteRepository;

    @InjectMocks
    private ComprobanteService comprobanteService;

    @Test
    void testEmitirBoletaPagadaDigitalmente() {
        when(comprobanteRepository.findByOrdenId(101L)).thenReturn(Optional.empty());
        when(comprobanteRepository.contarPorTipo(TipoComprobante.BOLETA)).thenReturn(5L);
        when(comprobanteRepository.save(any(ComprobantePago.class))).thenAnswer(inv -> {
            ComprobantePago c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });

        EmitirComprobanteRequest req = new EmitirComprobanteRequest(
                101L, TipoComprobante.BOLETA, "DNI", "72345678",
                "Carlos Sanchez", "Av. Grau 123", new BigDecimal("65.50"),
                true, null);

        ComprobanteResponse res = comprobanteService.emitir(req, 1L);

        assertNotNull(res);
        assertEquals("B001-000006", res.serieCorrelativo());
        assertEquals("PAGADO", res.estadoPagoTexto());
        assertEquals(new BigDecimal("65.50"), res.total());
    }

    @Test
    void testEmitirBoletaContraPagoConVuelto() {
        when(comprobanteRepository.findByOrdenId(102L)).thenReturn(Optional.empty());
        when(comprobanteRepository.contarPorTipo(TipoComprobante.BOLETA)).thenReturn(99L);
        when(comprobanteRepository.save(any(ComprobantePago.class))).thenAnswer(inv -> {
            ComprobantePago c = inv.getArgument(0);
            c.setId(2L);
            return c;
        });

        EmitirComprobanteRequest req = new EmitirComprobanteRequest(
                102L, TipoComprobante.BOLETA, "DNI", "72345678",
                "Carlos Sanchez", "Av. Grau 123", new BigDecimal("82.00"),
                false, new BigDecimal("18.00"));

        ComprobanteResponse res = comprobanteService.emitir(req, 1L);

        assertNotNull(res);
        assertEquals("B001-000100", res.serieCorrelativo());
        assertTrue(res.estadoPagoTexto().contains("COBRAR EN EFECTIVO: S/ 82.00"));
        assertTrue(res.estadoPagoTexto().contains("VUELTO: S/ 18.00"));
    }

    @Test
    void testEmitirEsIdempotenteSiYaExiste() {
        ComprobantePago existente = ComprobantePago.builder()
                .id(99L)
                .ordenId(103L)
                .tipo(TipoComprobante.BOLETA)
                .serieCorrelativo("B001-000050")
                .clienteNombre("Ana Gomez")
                .subtotal(new BigDecimal("20.00"))
                .igv(new BigDecimal("3.60"))
                .total(new BigDecimal("23.60"))
                .estadoPagoTexto("PAGADO")
                .build();

        when(comprobanteRepository.findByOrdenId(103L)).thenReturn(Optional.of(existente));

        EmitirComprobanteRequest req = new EmitirComprobanteRequest(
                103L, TipoComprobante.BOLETA, "DNI", "72345678",
                "Ana Gomez", null, new BigDecimal("23.60"), true, null);

        ComprobanteResponse res = comprobanteService.emitir(req, 1L);

        assertEquals("B001-000050", res.serieCorrelativo());
        verify(comprobanteRepository, never()).save(any(ComprobantePago.class));
    }
}
