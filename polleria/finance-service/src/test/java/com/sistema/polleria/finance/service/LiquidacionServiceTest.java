package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.AperturaLiquidacionRequest;
import com.sistema.polleria.finance.dto.CierreLiquidacionRequest;
import com.sistema.polleria.finance.dto.LiquidacionResponse;
import com.sistema.polleria.finance.entity.*;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
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
        when(pagosClient.obtenerPendiente(any(), any(), any())).thenReturn(sinPendiente());
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
        when(pagosClient.obtenerPendiente(any(), any(), any())).thenReturn(sinPendiente());
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));

        // Esperado 150, pero rinde solo 140 (faltan S/ 10)
        CierreLiquidacionRequest req = new CierreLiquidacionRequest(
                new BigDecimal("140.00"), new BigDecimal("100.00"), "Faltó S/ 10.00");

        LiquidacionResponse res = liquidacionService.cerrar(2L, req, 2L, "Bearer t");

        assertEquals(EstadoLiquidacion.DISCREPANCIA, res.estado());
        assertEquals(new BigDecimal("-10.00"), res.diferencia());
    }

    private static PagosClient.EfectivoPendiente sinPendiente() {
        return new PagosClient.EfectivoPendiente(4L, BigDecimal.ZERO, 0, List.of());
    }

    @Test
    void cerrarGuardaEfectivoEsperadoDePaymentsYLaDiferenciaYMarcaLosPagosLiquidados() {
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(7L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(new BigDecimal("50.00")).estado(EstadoLiquidacion.ABIERTA)
                .creadoEn(LocalDateTime.of(2026, 1, 1, 9, 0)).build();
        when(liquidacionRepository.findById(7L)).thenReturn(Optional.of(liq));
        when(liquidacionRepository.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(pagosClient.obtenerPendiente(4L, liq.getCreadoEn(), "Bearer t")).thenReturn(new PagosClient.EfectivoPendiente(
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
    void efectivoPendienteUsaLaAperturaDeLaLiquidacionAbierta() {
        LocalDateTime apertura = LocalDateTime.of(2026, 1, 1, 9, 0);
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(9L).repartidorId(4L).repartidorNombre("Juan").estado(EstadoLiquidacion.ABIERTA).creadoEn(apertura).build();
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.of(liq));
        when(pagosClient.obtenerPendiente(4L, apertura, "Bearer r")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("70.00"), 1,
                List.of(new PagosClient.EfectivoPendiente.Item(11L, 100L, new BigDecimal("70.00"), null))));

        var res = liquidacionService.efectivoPendiente(4L, "Bearer r");

        assertEquals(9L, res.liquidacionId());
        assertEquals(apertura, res.desde());
        assertEquals(new BigDecimal("70.00"), res.total());
        assertEquals(1, res.cantidad());
    }

    @Test
    void efectivoPendienteSinLiquidacionAbiertaEsNoEncontrado() {
        when(liquidacionRepository.findFirstByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA))
                .thenReturn(Optional.empty());

        assertThrows(java.util.NoSuchElementException.class, () -> liquidacionService.efectivoPendiente(4L, "Bearer r"));
    }
}
