package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.AperturaLiquidacionRequest;
import com.sistema.polleria.finance.dto.CierreLiquidacionRequest;
import com.sistema.polleria.finance.dto.CobroRepartidorResponse;
import com.sistema.polleria.finance.dto.LiquidacionResponse;
import com.sistema.polleria.finance.dto.RecargaFondoRequest;
import com.sistema.polleria.finance.dto.RegistrarCobroRepartidorRequest;
import com.sistema.polleria.finance.entity.*;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.CobroRepartidorRepository;
import com.sistema.polleria.finance.repository.LiquidacionRepartidorRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LiquidacionServiceTest {

    @Mock
    private LiquidacionRepartidorRepository liquidacionRepository;

    @Mock
    private CobroRepartidorRepository cobroRepartidorRepository;

    @Mock
    private ArqueoCajaRepository arqueoRepository;

    @Mock
    private MovimientoCajaRepository movimientoRepository;

    @Mock
    private PagosClient pagosClient;

    @InjectMocks
    private LiquidacionService liquidacionService;

    @Test
    void testAbrirLiquidacionConFondoInicialGeneraEgresoEnCaja() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.empty());
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> {
            LiquidacionRepartidor l = inv.getArgument(0);
            l.setId(1L);
            return l;
        });

        AperturaLiquidacionRequest req = new AperturaLiquidacionRequest(
                4L, "Repartidor Juan", new BigDecimal("50.00"), "Turno tarde");

        LiquidacionResponse res = liquidacionService.abrir(req, 2L);

        assertNotNull(res);
        assertEquals(EstadoLiquidacion.ABIERTA, res.estado());
        assertEquals(new BigDecimal("50.00"), res.fondoInicial());
        verify(movimientoRepository).save(any(MovimientoCaja.class)); // egreso registrado
    }

    @Test
    void testRecargarFondoLiquidacionAbiertaExitoso() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(5L)
                .repartidorId(4L)
                .repartidorNombre("Repartidor Juan")
                .fondoInicial(new BigDecimal("50.00"))
                .estado(EstadoLiquidacion.ABIERTA)
                .observaciones("Turno noche")
                .build();
        when(liquidacionRepository.findById(5L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        RecargaFondoRequest req = new RecargaFondoRequest(new BigDecimal("30.00"), "Monedas de 2 y 5 soles");
        LiquidacionResponse res = liquidacionService.recargarFondo(5L, req, 2L);

        assertNotNull(res);
        assertEquals(new BigDecimal("80.00"), res.fondoInicial());
        assertTrue(res.observaciones().contains("Recarga fondo S/ 30.00"));
        verify(movimientoRepository).save(any(MovimientoCaja.class)); // egreso registrado
    }

    @Test
    void testRecargarFondoLiquidacionCerradaFalla() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(5L)
                .estado(EstadoLiquidacion.CERRADA)
                .build();
        when(liquidacionRepository.findById(5L)).thenReturn(Optional.of(liq));

        RecargaFondoRequest req = new RecargaFondoRequest(new BigDecimal("30.00"), "Mas monedas");
        assertThrows(IllegalStateException.class, () -> liquidacionService.recargarFondo(5L, req, 2L));
    }

    @Test
    void testRecargarFondoMontoInvalidoFalla() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(5L)
                .estado(EstadoLiquidacion.ABIERTA)
                .build();
        when(liquidacionRepository.findById(5L)).thenReturn(Optional.of(liq));

        RecargaFondoRequest reqCero = new RecargaFondoRequest(BigDecimal.ZERO, "Cero");
        assertThrows(IllegalArgumentException.class, () -> liquidacionService.recargarFondo(5L, reqCero, 2L));
    }

    @Test
    void testRecargarFondoSinCajaAbiertaFalla() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(5L)
                .estado(EstadoLiquidacion.ABIERTA)
                .build();
        when(liquidacionRepository.findById(5L)).thenReturn(Optional.of(liq));
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());

        RecargaFondoRequest req = new RecargaFondoRequest(new BigDecimal("20.00"), "Sin caja");
        assertThrows(IllegalStateException.class, () -> liquidacionService.recargarFondo(5L, req, 2L));
    }

    @Test
    void testCerrarLiquidacionCuadradaGeneraIngresoEnCaja() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(1L)
                .repartidorId(4L)
                .repartidorNombre("Repartidor Juan")
                .fondoInicial(new BigDecimal("50.00"))
                .totalCobradoEfectivo(new BigDecimal("150.00"))
                .estado(EstadoLiquidacion.ABIERTA)
                .build();

        when(liquidacionRepository.findById(1L)).thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(any(), any(), any())).thenReturn(pendienteDe("150.00"));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        // Rinde exactamente 50 + 150 = 200
        CierreLiquidacionRequest req = new CierreLiquidacionRequest(
                new BigDecimal("200.00"), new BigDecimal("150.00"), "Todo conforme");

        LiquidacionResponse res = liquidacionService.cerrar(1L, req, 2L, "Bearer t");

        assertEquals(EstadoLiquidacion.CERRADA, res.estado());
        assertEquals(new BigDecimal("0.00"), res.diferencia());
        verify(movimientoRepository).save(any(MovimientoCaja.class)); // ingreso registrado en caja
    }

    @Test
    void testCerrarLiquidacionConFaltanteMarcaDiscrepancia() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(2L)
                .repartidorId(5L)
                .repartidorNombre("Repartidor Pedro")
                .fondoInicial(new BigDecimal("50.00"))
                .totalCobradoEfectivo(new BigDecimal("100.00"))
                .estado(EstadoLiquidacion.ABIERTA)
                .build();

        when(liquidacionRepository.findById(2L)).thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(any(), any(), any())).thenReturn(pendienteDe("100.00"));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        // Esperado 150, pero rinde solo 140 (faltan S/ 10)
        CierreLiquidacionRequest req = new CierreLiquidacionRequest(
                new BigDecimal("140.00"), new BigDecimal("100.00"), "Faltó S/ 10.00");

        LiquidacionResponse res = liquidacionService.cerrar(2L, req, 2L, "Bearer t");

        assertEquals(EstadoLiquidacion.DISCREPANCIA, res.estado());
        assertEquals(new BigDecimal("-10.00"), res.diferencia());
    }

    private static PagosClient.EfectivoPendiente pendienteDe(String monto) {
        return new PagosClient.EfectivoPendiente(4L, new BigDecimal(monto), 1,
                List.of(new PagosClient.EfectivoPendiente.Item(90L, 900L, new BigDecimal(monto), null)));
    }

    @Test
    void cerrarIncluyeEfectivoCobradoAntesDeAbrirLaLiquidacion() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(20L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(BigDecimal.ZERO).estado(EstadoLiquidacion.ABIERTA)
                .creadoEn(LocalDateTime.of(2026, 1, 1, 9, 0)).build();
        when(liquidacionRepository.findById(20L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        // Cash collected at 08:00, before the 09:00 apertura, and still not linked to any settlement.
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("40.00"), 1, List.of(new PagosClient.EfectivoPendiente.Item(
                        30L, 300L, new BigDecimal("40.00"), LocalDateTime.of(2026, 1, 1, 8, 0)))));

        LiquidacionResponse res = liquidacionService.cerrar(20L,
                new CierreLiquidacionRequest(new BigDecimal("40.00"), null, null), 2L, "Bearer t");

        assertEquals(new BigDecimal("40.00"), res.totalEsperadoEfectivo());
        assertEquals(EstadoLiquidacion.CERRADA, res.estado());
        verify(pagosClient).liquidar(List.of(30L), 20L, "Bearer t");
    }

    @Test
    void cerrarCalculaLaDiscrepanciaContraElEfectivoDePaymentsYNoContraElTipeadoPorElCajero() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(21L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(new BigDecimal("50.00")).estado(EstadoLiquidacion.ABIERTA)
                .creadoEn(LocalDateTime.of(2026, 1, 1, 9, 0)).build();
        when(liquidacionRepository.findById(21L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pagosClient.obtenerPendiente(any(), any(), any())).thenReturn(pendienteDe("150.00"));

        // The cashier typed 100 and the courier handed in 50 + 100, but payments recorded 150 in cash.
        LiquidacionResponse res = liquidacionService.cerrar(21L,
                new CierreLiquidacionRequest(new BigDecimal("150.00"), new BigDecimal("100.00"), null), 2L, "Bearer t");

        assertEquals(EstadoLiquidacion.DISCREPANCIA, res.estado());
        assertEquals(new BigDecimal("-50.00"), res.diferencia());
    }

    @Test
    void cerrarGuardaEfectivoEsperadoDePaymentsYLaDiferenciaYMarcaLosPagosLiquidados() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(7L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(new BigDecimal("50.00")).estado(EstadoLiquidacion.ABIERTA)
                .creadoEn(LocalDateTime.of(2026, 1, 1, 9, 0)).build();
        when(liquidacionRepository.findById(7L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("120.00"), 2, List.of(
                        new PagosClient.EfectivoPendiente.Item(11L, 100L, new BigDecimal("70.00"), null),
                        new PagosClient.EfectivoPendiente.Item(12L, 101L, new BigDecimal("50.00"), null))));

        // The cashier counted only 110 of the 120 the app recorded.
        LiquidacionResponse res = liquidacionService.cerrar(7L,
                new CierreLiquidacionRequest(new BigDecimal("160.00"), new BigDecimal("110.00"), null), 2L, "Bearer t");

        assertEquals(new BigDecimal("120.00"), res.totalEsperadoEfectivo());
        assertEquals(new BigDecimal("110.00"), res.totalCobradoEfectivo());
        assertEquals(new BigDecimal("-10.00"), res.diferenciaEfectivo());
        verify(pagosClient).liquidar(List.of(11L, 12L), 7L, "Bearer t");
    }

    @Test
    void cerrarFallaCerradoSiPaymentsNoResponde() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(8L).repartidorId(4L).repartidorNombre("Juan").estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findById(8L)).thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(any(), any(), any()))
                .thenThrow(new PagosClient.PagosNoDisponibleException("down", null));

        assertThrows(PagosClient.PagosNoDisponibleException.class, () -> liquidacionService.cerrar(8L,
                new CierreLiquidacionRequest(new BigDecimal("10.00"), new BigDecimal("10.00"), null), 2L, "Bearer t"));

        verify(liquidacionRepository, never()).save(any(LiquidacionRepartidor.class));
        assertEquals(EstadoLiquidacion.ABIERTA, liq.getEstado());
    }

    @Test
    void efectivoPendienteNoCortaPorLaAperturaDeLaLiquidacionAbierta() {
        LocalDateTime apertura = LocalDateTime.of(2026, 1, 1, 9, 0);
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(9L).repartidorId(4L).repartidorNombre("Juan").estado(EstadoLiquidacion.ABIERTA).creadoEn(apertura).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer r")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("70.00"), 1,
                List.of(new PagosClient.EfectivoPendiente.Item(11L, 100L, new BigDecimal("70.00"), null))));

        var res = liquidacionService.efectivoPendiente(4L, "Bearer r");

        assertEquals(9L, res.liquidacionId());
        assertEquals(apertura, res.desde());
        assertEquals(new BigDecimal("70.00"), res.total());
        assertEquals(1, res.cantidad());
    }

    @Test
    void efectivoPendienteSinLiquidacionAbiertaDevuelveEfectivoDePagosResiliente() {
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.empty());
        when(pagosClient.obtenerPendiente(4L, null, "Bearer r")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("70.00"), 1,
                List.of(new PagosClient.EfectivoPendiente.Item(11L, 100L, new BigDecimal("70.00"), null))));

        var res = liquidacionService.efectivoPendiente(4L, "Bearer r");

        assertNull(res.liquidacionId());
        assertNull(res.desde());
        assertEquals(new BigDecimal("70.00"), res.total());
        assertEquals(new BigDecimal("70.00"), res.totalCobrado());
        assertEquals(BigDecimal.ZERO, res.totalRendido());
        assertEquals(1, res.cantidad());
    }

    @Test
    void registrarCobroParcialDisminuyeSaldoYRegistraMovimiento() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(1L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(new BigDecimal("20.00")).totalRendido(BigDecimal.ZERO)
                .estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        // Orders total 100.00 (fondo 20 + orders 100 = 120 esperado)
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(pendienteDe("100.00"));
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(1L)).thenReturn(BigDecimal.ZERO);
        when(cobroRepartidorRepository.save(any(CobroRepartidor.class))).thenAnswer(inv -> {
            CobroRepartidor c = inv.getArgument(0);
            c.setId(50L);
            return c;
        });
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        // Cobro parcial de 50.00
        RegistrarCobroRepartidorRequest req = new RegistrarCobroRepartidorRequest(
                4L, "Juan", new BigDecimal("50.00"), "Cobro a media jornada");

        CobroRepartidorResponse res = liquidacionService.registrarCobro(req, 2L, "Bearer t");

        assertNotNull(res);
        assertEquals(50L, res.id());
        assertEquals(new BigDecimal("50.00"), res.monto());
        // 120 - 50 = 70 restante
        assertEquals(new BigDecimal("70.00"), res.saldoRestante());
        assertEquals(new BigDecimal("50.00"), liq.getTotalRendido());
        assertEquals(EstadoLiquidacion.ABIERTA, liq.getEstado());
        verify(movimientoRepository).save(any(MovimientoCaja.class)); // Ingreso a caja registrado
        verify(pagosClient, never()).liquidar(any(), any(), any()); // No liquida aún porque queda saldo
    }

    @Test
    void registrarCobroTotalLiquidaPagosYCierraLiquidacion() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(1L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(BigDecimal.ZERO).totalRendido(new BigDecimal("30.00"))
                .estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(pendienteDe("100.00"));
        // Previamente rindió 30, así que saldo restante = 100 - 30 = 70
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(1L)).thenReturn(new BigDecimal("30.00"));
        when(cobroRepartidorRepository.save(any(CobroRepartidor.class))).thenAnswer(inv -> {
            CobroRepartidor c = inv.getArgument(0);
            c.setId(51L);
            return c;
        });
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        // Cobra exactamente los 70 restantes
        RegistrarCobroRepartidorRequest req = new RegistrarCobroRepartidorRequest(
                4L, "Juan", new BigDecimal("70.00"), "Cobro final de turno");

        CobroRepartidorResponse res = liquidacionService.registrarCobro(req, 2L, "Bearer t");

        assertNotNull(res);
        assertEquals(new BigDecimal("0.00"), res.saldoRestante());
        assertEquals(new BigDecimal("100.00"), liq.getTotalRendido());
        assertEquals(EstadoLiquidacion.CERRADA, liq.getEstado());
        verify(pagosClient).liquidar(List.of(90L), 1L, "Bearer t"); // Liquida pagos al llegar a 0
    }

    @Test
    void registrarCobroExcedeSaldoLanzaExcepcion() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(1L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(BigDecimal.ZERO).totalRendido(BigDecimal.ZERO)
                .estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(pendienteDe("50.00"));
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(1L)).thenReturn(BigDecimal.ZERO);

        RegistrarCobroRepartidorRequest req = new RegistrarCobroRepartidorRequest(
                4L, "Juan", new BigDecimal("80.00"), "Excede saldo");

        assertThrows(IllegalArgumentException.class, () ->
                liquidacionService.registrarCobro(req, 2L, "Bearer t"));
    }

    @Test
    void efectivoPendienteDescuentaCobrosPrevios() {
        LocalDateTime apertura = LocalDateTime.of(2026, 1, 1, 9, 0);
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(9L).repartidorId(4L).repartidorNombre("Juan").estado(EstadoLiquidacion.ABIERTA)
                .fondoInicial(new BigDecimal("20.00")).creadoEn(apertura).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        // Cobrado en pedidos: 100.00
        when(pagosClient.obtenerPendiente(4L, null, "Bearer r")).thenReturn(pendienteDe("100.00"));
        // Ya entregó en caja: 40.00
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(9L)).thenReturn(new BigDecimal("40.00"));

        var res = liquidacionService.efectivoPendiente(4L, "Bearer r");

        // Saldo neto = (fondo 20 + pedidos 100) - ya entregado 40 = 80
        assertEquals(new BigDecimal("80.00"), res.total());
        assertEquals(new BigDecimal("100.00"), res.totalCobrado());
        assertEquals(new BigDecimal("40.00"), res.totalRendido());
    }

    @Test
    void cerrarDescuentaCobrosPreviosParaEvitarDuplicacionEnCajaChica() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(25L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(BigDecimal.ZERO).totalRendido(new BigDecimal("60.00"))
                .estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findById(25L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(pendienteDe("100.00"));
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(25L)).thenReturn(new BigDecimal("60.00"));

        // Repartidor cierra entregando el total de 100 (60 previos + 40 ahora)
        LiquidacionResponse res = liquidacionService.cerrar(25L,
                new CierreLiquidacionRequest(new BigDecimal("100.00"), new BigDecimal("100.00"), "Cierre final"),
                2L, "Bearer t");

        assertEquals(EstadoLiquidacion.CERRADA, res.estado());
        assertEquals(new BigDecimal("100.00"), res.totalRendido());
        assertEquals(0, res.diferencia().compareTo(BigDecimal.ZERO));

        // Caja chica SOLO debe registrar el remanente de 40.00, NO los 100.00
        verify(movimientoRepository).save(argThat(m ->
                m.getTipo() == TipoMovimiento.INGRESO &&
                m.getMonto().compareTo(new BigDecimal("40.00")) == 0));
        verify(cobroRepartidorRepository).save(argThat(c ->
                c.getMonto().compareTo(new BigDecimal("40.00")) == 0 &&
                c.getLiquidacionId().equals(25L)));
    }

    @Test
    void registrarCobroCierraLiquidacionAunqueNoHayanPagosPendientes() {
        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));

        // Courier returns S/ 30.00 float, no cash orders delivered
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(30L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(new BigDecimal("30.00")).totalRendido(BigDecimal.ZERO)
                .estado(EstadoLiquidacion.ABIERTA).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(
                new PagosClient.EfectivoPendiente(4L, BigDecimal.ZERO, 0, List.of()));
        when(cobroRepartidorRepository.sumMontoByLiquidacionId(30L)).thenReturn(BigDecimal.ZERO);
        when(cobroRepartidorRepository.save(any(CobroRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        RegistrarCobroRepartidorRequest req = new RegistrarCobroRepartidorRequest(
                4L, "Juan", new BigDecimal("30.00"), "Devolución fondo inicial");

        var res = liquidacionService.registrarCobro(req, 2L, "Bearer t");

        assertEquals(0, res.saldoRestante().compareTo(BigDecimal.ZERO));
        assertEquals(EstadoLiquidacion.CERRADA, liq.getEstado());
        verify(pagosClient, never()).liquidar(any(), any(), any());
    }
}
