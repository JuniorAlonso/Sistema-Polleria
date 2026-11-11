package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
import com.sistema.polleria.finance.service.comprobante.FuenteTotalComprobante;
import com.sistema.polleria.finance.service.comprobante.GeneradorCorrelativo;
import com.sistema.polleria.finance.service.comprobante.RegistradorIngresoCaja;
import com.sistema.polleria.finance.service.comprobante.ValidadorDatosFiscales;
import com.sistema.polleria.finance.service.comprobante.ValidadorIngresoEfectivo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ComprobanteServiceTest {

    @Mock
    private ComprobantePagoRepository comprobanteRepository;
    @Mock
    private FuenteTotalComprobante fuenteTotal;
    @Mock
    private ValidadorDatosFiscales validadorDatosFiscales;
    @Mock
    private GeneradorCorrelativo generadorCorrelativo;
    @Mock
    private RegistradorIngresoCaja registradorIngresoCaja;
    @Mock
    private ValidadorIngresoEfectivo validadorIngresoEfectivo;

    @InjectMocks
    private ComprobanteService comprobanteService;

    private static final String BEARER = "Bearer cajero";

    private void guardadoConId(long id) {
        when(comprobanteRepository.save(any(ComprobantePago.class))).thenAnswer(inv -> {
            ComprobantePago c = inv.getArgument(0);
            c.setId(id);
            return c;
        });
    }

    private EmitirComprobanteRequest boleta(long ordenId, String totalEnviado, boolean pagado,
                                            String vuelto, Boolean ingresoCaja) {
        return new EmitirComprobanteRequest(
                ordenId, TipoComprobante.BOLETA, "DNI", "72345678",
                "Carlos Sanchez", "Av. Grau 123", totalEnviado == null ? null : new BigDecimal(totalEnviado),
                pagado, vuelto == null ? null : new BigDecimal(vuelto), ingresoCaja);
    }

    @Test
    void emiteLaBoletaConElTotalDeLaFuenteYNoElDelNavegador() {
        when(comprobanteRepository.findByOrdenId(101L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(101L, BEARER)).thenReturn(new BigDecimal("65.50"));
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000006");
        guardadoConId(1L);

        ComprobanteResponse res = comprobanteService.emitir(boleta(101L, "1.00", true, null, null), 9L, BEARER);

        assertEquals("B001-000006", res.serieCorrelativo());
        assertEquals("PAGADO", res.estadoPagoTexto());
        assertEquals(0, new BigDecimal("65.50").compareTo(res.total()));
        assertEquals(0, new BigDecimal("55.51").compareTo(res.subtotal()));
        assertEquals(0, new BigDecimal("9.99").compareTo(res.igv()));
        assertEquals(9L, res.emitidoPor());
        verify(validadorDatosFiscales).validar(TipoComprobante.BOLETA, "72345678", new BigDecimal("65.50"));
        verifyNoInteractions(registradorIngresoCaja);
    }

    @Test
    void contraentregaMuestraElMontoACobrarYElVuelto() {
        when(comprobanteRepository.findByOrdenId(102L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(102L, BEARER)).thenReturn(new BigDecimal("82.00"));
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000100");
        guardadoConId(2L);

        ComprobanteResponse res = comprobanteService.emitir(boleta(102L, null, false, "18.00", null), 9L, BEARER);

        assertTrue(res.estadoPagoTexto().contains("COBRAR EN EFECTIVO: S/ 82.00"));
        assertTrue(res.estadoPagoTexto().contains("VUELTO: S/ 18.00"));
    }

    @Test
    void conIngresoCajaRegistraElIngresoPorElTotalDelComprobante() {
        when(comprobanteRepository.findByOrdenId(104L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(104L, BEARER)).thenReturn(new BigDecimal("30.00"));
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000007");
        guardadoConId(3L);

        comprobanteService.emitir(boleta(104L, null, true, null, true), 9L, BEARER);

        verify(registradorIngresoCaja).registrar(eq(104L), eq(new BigDecimal("30.00")), anyString(), eq(9L));
    }

    @Test
    void siYaExisteLoDevuelveSinEmitirOtroYAunAsiRegistraElIngresoPendiente() {
        ComprobantePago existente = ComprobantePago.builder()
                .id(99L).ordenId(103L).tipo(TipoComprobante.BOLETA).serieCorrelativo("B001-000050")
                .clienteNombre("Ana Gomez").subtotal(new BigDecimal("20.00")).igv(new BigDecimal("3.60"))
                .total(new BigDecimal("23.60")).estadoPagoTexto("PAGADO").build();
        when(comprobanteRepository.findByOrdenId(103L)).thenReturn(Optional.of(existente));

        ComprobanteResponse res = comprobanteService.emitir(boleta(103L, null, true, null, true), 9L, BEARER);

        assertEquals("B001-000050", res.serieCorrelativo());
        verify(comprobanteRepository, never()).save(any(ComprobantePago.class));
        verifyNoInteractions(generadorCorrelativo, fuenteTotal);
        verify(registradorIngresoCaja).registrar(eq(103L), eq(new BigDecimal("23.60")), anyString(), eq(9L));
    }

    @Test
    void siOtraEmisionGanoElBloqueoDevuelveLaSuya() {
        ComprobantePago ganador = ComprobantePago.builder()
                .id(5L).ordenId(105L).tipo(TipoComprobante.BOLETA).serieCorrelativo("B001-000008")
                .clienteNombre("X").subtotal(BigDecimal.ONE).igv(BigDecimal.ZERO).total(BigDecimal.ONE)
                .estadoPagoTexto("PAGADO").build();
        when(comprobanteRepository.findByOrdenId(105L)).thenReturn(Optional.empty(), Optional.of(ganador));
        when(fuenteTotal.totalDe(105L, BEARER)).thenReturn(BigDecimal.ONE);
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000009");

        ComprobanteResponse res = comprobanteService.emitir(boleta(105L, null, true, null, null), 9L, BEARER);

        assertEquals("B001-000008", res.serieCorrelativo());
        verify(comprobanteRepository, never()).save(any(ComprobantePago.class));
    }

    @Test
    void unIngresoDeCajaParaUnPagoQueNoFueEnEfectivoSeRechazaSinRegistrarlo() {
        ComprobantePago existente = ComprobantePago.builder()
                .id(98L).ordenId(108L).tipo(TipoComprobante.BOLETA).serieCorrelativo("B001-000060")
                .clienteNombre("X").subtotal(BigDecimal.ONE).igv(BigDecimal.ZERO).total(BigDecimal.ONE)
                .estadoPagoTexto("PAGADO").build();
        when(comprobanteRepository.findByOrdenId(108L)).thenReturn(Optional.of(existente));
        doThrow(new IllegalStateException("El pago de la orden no fue en efectivo"))
                .when(validadorIngresoEfectivo).validar(108L, BEARER);

        assertThrows(IllegalStateException.class,
                () -> comprobanteService.emitir(boleta(108L, null, true, null, true), 9L, BEARER));
        verifyNoInteractions(registradorIngresoCaja);
    }

    @Test
    void sinIngresoDeCajaNoSeConsultaElMetodoDelPago() {
        when(comprobanteRepository.findByOrdenId(109L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(109L, BEARER)).thenReturn(BigDecimal.TEN);
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000011");
        guardadoConId(6L);

        comprobanteService.emitir(boleta(109L, null, true, null, false), 9L, BEARER);

        verifyNoInteractions(validadorIngresoEfectivo);
    }

    @Test
    void datosFiscalesInvalidosNoEmitenNada() {
        when(comprobanteRepository.findByOrdenId(106L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(106L, BEARER)).thenReturn(new BigDecimal("900.00"));
        doThrow(new IllegalArgumentException("DNI requerido"))
                .when(validadorDatosFiscales).validar(any(), any(), any());

        assertThrows(IllegalArgumentException.class,
                () -> comprobanteService.emitir(boleta(106L, null, true, null, true), 9L, BEARER));
        verify(comprobanteRepository, never()).save(any(ComprobantePago.class));
        verifyNoInteractions(generadorCorrelativo, registradorIngresoCaja);
    }

    @Test
    void elRegistroDelEmisorSeGuarda() {
        when(comprobanteRepository.findByOrdenId(107L)).thenReturn(Optional.empty());
        when(fuenteTotal.totalDe(107L, BEARER)).thenReturn(BigDecimal.TEN);
        when(generadorCorrelativo.siguiente(TipoComprobante.BOLETA)).thenReturn("B001-000010");
        guardadoConId(4L);

        comprobanteService.emitir(boleta(107L, null, true, null, false), 42L, BEARER);

        ArgumentCaptor<ComprobantePago> captor = ArgumentCaptor.forClass(ComprobantePago.class);
        verify(comprobanteRepository).save(captor.capture());
        assertEquals(42L, captor.getValue().getEmitidoPor());
        verifyNoInteractions(registradorIngresoCaja);
    }
}
