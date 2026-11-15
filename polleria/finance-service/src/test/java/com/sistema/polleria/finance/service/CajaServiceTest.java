package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.AperturaCajaRequest;
import com.sistema.polleria.finance.dto.ArqueoCajaResponse;
import com.sistema.polleria.finance.dto.CierreCajaRequest;
import com.sistema.polleria.finance.dto.MovimientoCajaRequest;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.CategoriaMovimiento;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CajaServiceTest {

    @Mock
    private ArqueoCajaRepository arqueoRepository;

    @Mock
    private MovimientoCajaRepository movimientoRepository;

    @InjectMocks
    private CajaService cajaService;

    @Test
    @DisplayName("Debe abrir la caja correctamente cuando no hay otra caja abierta")
    void abrirCaja_exitoso() {
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());

        when(arqueoRepository.saveAndFlush(any(ArqueoCaja.class))).thenAnswer(inv -> {
            ArqueoCaja a = inv.getArgument(0);
            a.setId(1L);
            return a;
        });

        AperturaCajaRequest req = AperturaCajaRequest.builder()
                .usuarioNombre("Carlos Cajero")
                .montoApertura(new BigDecimal("150.00"))
                .observaciones("Fondo inicial de monedas y billetes")
                .build();

        ArqueoCajaResponse res = cajaService.abrirCaja(req, 5L);

        assertThat(res.getId()).isEqualTo(1L);
        assertThat(res.getEstado()).isEqualTo(EstadoCaja.ABIERTA);
        assertThat(res.getMontoApertura()).isEqualByComparingTo("150.00");
        verify(arqueoRepository).saveAndFlush(any(ArqueoCaja.class));
    }

    @Test
    @DisplayName("Debe rechazar la apertura si ya existe una caja abierta")
    void abrirCaja_fallaSiYaExisteAbierta() {
        ArqueoCaja abierta = ArqueoCaja.builder().id(99L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(abierta));

        AperturaCajaRequest req = AperturaCajaRequest.builder()
                .montoApertura(new BigDecimal("100.00"))
                .build();

        assertThatThrownBy(() -> cajaService.abrirCaja(req, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Ya existe una caja abierta");

        verify(arqueoRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("R3.1: una apertura simultánea que pierde contra el índice único responde 409, no 500")
    void abrirCaja_aperturaSimultaneaRespondeConflicto() {
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());
        when(arqueoRepository.saveAndFlush(any(ArqueoCaja.class)))
                .thenThrow(new DataIntegrityViolationException("uq_arqueos_caja_abierta"));

        AperturaCajaRequest req = AperturaCajaRequest.builder().montoApertura(new BigDecimal("100.00")).build();

        assertThatThrownBy(() -> cajaService.abrirCaja(req, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Ya existe una caja abierta");
    }

    @Test
    @DisplayName("Debe registrar un movimiento de caja chica vinculado al arqueo activo")
    void registrarMovimiento_exitoso() {
        ArqueoCaja activa = ArqueoCaja.builder().id(1L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(activa));

        when(movimientoRepository.save(any(MovimientoCaja.class))).thenAnswer(inv -> {
            MovimientoCaja m = inv.getArgument(0);
            m.setId(10L);
            return m;
        });

        MovimientoCajaRequest req = MovimientoCajaRequest.builder()
                .tipo(TipoMovimiento.EGRESO)
                .monto(new BigDecimal("25.50"))
                .motivo("Compra de servilletas urgentes")
                .build();

        MovimientoCaja res = cajaService.registrarMovimiento(req, 5L);

        assertThat(res.getId()).isEqualTo(10L);
        assertThat(res.getArqueoId()).isEqualTo(1L);
        assertThat(res.getTipo()).isEqualTo(TipoMovimiento.EGRESO);
        assertThat(res.getMonto()).isEqualByComparingTo("25.50");
        verify(movimientoRepository).save(argThat(m -> m.getCategoria() == CategoriaMovimiento.MANUAL));
    }

    @Test
    @DisplayName("Debe cerrar la caja y calcular la diferencia exacta entre monto esperado y contado")
    void cerrarCaja_calculaDiferencia() {
        ArqueoCaja activa = ArqueoCaja.builder()
                .id(1L)
                .montoApertura(new BigDecimal("100.00"))
                .estado(EstadoCaja.ABIERTA)
                .fechaApertura(LocalDateTime.now())
                .build();

        when(arqueoRepository.findByIdParaActualizar(1L)).thenReturn(Optional.of(activa));

        // Ingresos extras en caja chica: 50.00
        MovimientoCaja ing = MovimientoCaja.builder().monto(new BigDecimal("50.00")).tipo(TipoMovimiento.INGRESO).build();
        // Egresos en caja chica: 20.00
        MovimientoCaja eg = MovimientoCaja.builder().monto(new BigDecimal("20.00")).tipo(TipoMovimiento.EGRESO).build();

        when(movimientoRepository.findByArqueoIdAndTipo(1L, TipoMovimiento.INGRESO)).thenReturn(List.of(ing));
        when(movimientoRepository.findByArqueoIdAndTipo(1L, TipoMovimiento.EGRESO)).thenReturn(List.of(eg));
        when(arqueoRepository.save(any(ArqueoCaja.class))).thenAnswer(inv -> inv.getArgument(0));

        // Esperado = 100 + 50 - 20 = 130.00
        // Contado = 125.00 -> Faltante de 5.00 (diferencia: -5.00)
        CierreCajaRequest req = CierreCajaRequest.builder()
                .montoCierreEfectivo(new BigDecimal("125.00"))
                .montoCierrePos(new BigDecimal("350.00"))
                .ventasDigitales(new BigDecimal("200.00"))
                .observaciones("Faltante menor de S/ 5 en sencillo")
                .build();

        ArqueoCajaResponse res = cajaService.cerrarCaja(1L, req, 5L);

        assertThat(res.getEstado()).isEqualTo(EstadoCaja.CERRADA);
        assertThat(res.getTotalEsperado()).isEqualByComparingTo("130.00");
        assertThat(res.getDiferencia()).isEqualByComparingTo("-5.00");
        assertThat(res.getMontoCierrePos()).isEqualByComparingTo("350.00");
        verify(arqueoRepository).save(activa);
    }

    @Test
    @DisplayName("Debe listar los movimientos de la caja abierta")
    void listarMovimientos_devuelveLosDeLaCajaAbierta() {
        ArqueoCaja abierta = ArqueoCaja.builder().id(7L).estado(EstadoCaja.ABIERTA).build();
        MovimientoCaja egreso = MovimientoCaja.builder().id(2L).arqueoId(7L).monto(new BigDecimal("20.00")).build();

        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(abierta));
        when(movimientoRepository.findByArqueoIdOrderByFechaDesc(7L)).thenReturn(List.of(egreso));

        List<MovimientoCaja> movimientos = cajaService.listarMovimientosDeCajaAbierta();

        assertThat(movimientos).containsExactly(egreso);
        verify(movimientoRepository).findByArqueoIdOrderByFechaDesc(7L);
    }

    @Test
    @DisplayName("Sin caja abierta el listado de movimientos es vacío, no un error")
    void listarMovimientos_sinCajaAbiertaDevuelveVacio() {
        when(arqueoRepository.findFirstByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.empty());

        assertThat(cajaService.listarMovimientosDeCajaAbierta()).isEmpty();
        verifyNoInteractions(movimientoRepository);
    }

    private ArqueoCaja cajaConFaltanteDeCinco() {
        ArqueoCaja activa = ArqueoCaja.builder()
                .id(1L)
                .montoApertura(new BigDecimal("100.00"))
                .estado(EstadoCaja.ABIERTA)
                .fechaApertura(LocalDateTime.now())
                .build();
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA)).thenReturn(Optional.of(activa));
        when(movimientoRepository.findByArqueoIdAndTipo(1L, TipoMovimiento.INGRESO))
                .thenReturn(List.of(MovimientoCaja.builder().monto(new BigDecimal("50.00")).build()));
        when(movimientoRepository.findByArqueoIdAndTipo(1L, TipoMovimiento.EGRESO))
                .thenReturn(List.of(MovimientoCaja.builder().monto(new BigDecimal("20.00")).build()));
        return activa;
    }

    private CierreCajaRequest contado(String efectivo, String observaciones) {
        return CierreCajaRequest.builder()
                .montoCierreEfectivo(new BigDecimal(efectivo))
                .montoCierrePos(BigDecimal.ZERO)
                .observaciones(observaciones)
                .build();
    }

    @Test
    @DisplayName("R3.8: con diferencia -5.00 y sin observación responde 400 sin revelar el monto esperado")
    void cerrarCaja_conDiferenciaSinObservacionEsRechazado() {
        ArqueoCaja activa = cajaConFaltanteDeCinco();

        for (String obs : new String[]{null, "", "   "}) {
            assertThatThrownBy(() -> cajaService.cerrarCaja(null, contado("125.00", obs), 5L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("motivo")
                    .satisfies(e -> assertThat(e.getMessage()).doesNotContain("130").doesNotContain("5.00"));
        }

        assertThat(activa.getEstado()).isEqualTo(EstadoCaja.ABIERTA);
        verify(arqueoRepository, never()).save(any());
    }

    @Test
    @DisplayName("R3.8: con observación cierra con diferencia -5.00 y registra quién cerró")
    void cerrarCaja_conDiferenciaYObservacionCierraYRegistraCerradoPor() {
        cajaConFaltanteDeCinco();
        when(arqueoRepository.save(any(ArqueoCaja.class))).thenAnswer(inv -> inv.getArgument(0));

        ArqueoCajaResponse res = cajaService.cerrarCaja(null, contado("125.00", "Faltante en sencillo"), 5L);

        ArgumentCaptor<ArqueoCaja> captor = ArgumentCaptor.forClass(ArqueoCaja.class);
        verify(arqueoRepository).save(captor.capture());
        assertThat(captor.getValue().getCerradoPor()).isEqualTo(5L);
        assertThat(captor.getValue().getUsuarioId()).as("quien abrió no cambia").isNull();
        assertThat(res.getDiferencia()).isEqualByComparingTo("-5.00");
        assertThat(res.getObservaciones()).isEqualTo("Faltante en sencillo");
    }

    @Test
    @DisplayName("R3.8: sin diferencia cierra sin exigir observación")
    void cerrarCaja_cuadradaNoExigeObservacion() {
        cajaConFaltanteDeCinco();
        when(arqueoRepository.save(any(ArqueoCaja.class))).thenAnswer(inv -> inv.getArgument(0));

        ArqueoCajaResponse res = cajaService.cerrarCaja(null, contado("130.00", null), 5L);

        assertThat(res.getEstado()).isEqualTo(EstadoCaja.CERRADA);
        assertThat(res.getDiferencia()).isEqualByComparingTo("0.00");
    }

    private void cajaAbiertaDiez() {
        when(arqueoRepository.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build()));
    }

    private MovimientoCajaRequest devolucion(Long reclamoId, TipoMovimiento tipo) {
        MovimientoCajaRequest req = new MovimientoCajaRequest();
        req.setTipo(tipo);
        req.setMonto(new BigDecimal("30.00"));
        req.setMotivo("DEVOLUCION-RECLAMO #42");
        req.setCategoria(CategoriaMovimiento.DEVOLUCION);
        req.setReclamoId(reclamoId);
        return req;
    }

    @Test
    @DisplayName("Una devolución se registra como EGRESO DEVOLUCION ligado a su reclamo")
    void registrarDevolucionGuardaCategoriaYReclamo() {
        cajaAbiertaDiez();
        when(movimientoRepository.findFirstByReclamoIdAndCategoria(42L, CategoriaMovimiento.DEVOLUCION)).thenReturn(Optional.empty());
        when(movimientoRepository.saveAndFlush(any(MovimientoCaja.class))).thenAnswer(inv -> inv.getArgument(0));

        MovimientoCaja m = cajaService.registrarMovimiento(devolucion(42L, TipoMovimiento.EGRESO), 5L);

        assertThat(m.getCategoria()).isEqualTo(CategoriaMovimiento.DEVOLUCION);
        assertThat(m.getReclamoId()).isEqualTo(42L);
        assertThat(m.getTipo()).isEqualTo(TipoMovimiento.EGRESO);
        assertThat(m.getArqueoId()).isEqualTo(10L);
    }

    @Test
    @DisplayName("Reintentar la misma devolución devuelve el egreso existente y no lo duplica")
    void devolucionRepetidaEsIdempotente() {
        cajaAbiertaDiez();
        MovimientoCaja existente = MovimientoCaja.builder().id(7L).reclamoId(42L)
                .categoria(CategoriaMovimiento.DEVOLUCION).tipo(TipoMovimiento.EGRESO).monto(new BigDecimal("30.00")).build();
        when(movimientoRepository.findFirstByReclamoIdAndCategoria(42L, CategoriaMovimiento.DEVOLUCION)).thenReturn(Optional.of(existente));

        MovimientoCaja m = cajaService.registrarMovimiento(devolucion(42L, TipoMovimiento.EGRESO), 5L);

        assertThat(m.getId()).isEqualTo(7L);
        verify(movimientoRepository, never()).saveAndFlush(any());
        verify(movimientoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Dos devoluciones simultáneas del mismo reclamo: la que pierde contra el índice responde 409")
    void devolucionSimultaneaRespondeConflicto() {
        cajaAbiertaDiez();
        when(movimientoRepository.findFirstByReclamoIdAndCategoria(42L, CategoriaMovimiento.DEVOLUCION)).thenReturn(Optional.empty());
        when(movimientoRepository.saveAndFlush(any(MovimientoCaja.class)))
                .thenThrow(new DataIntegrityViolationException("uq_movimientos_devolucion_reclamo"));

        assertThatThrownBy(() -> cajaService.registrarMovimiento(devolucion(42L, TipoMovimiento.EGRESO), 5L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("reclamo #42");
    }

    @Test
    @DisplayName("Una devolución exige reclamo y debe ser EGRESO; las categorías internas no se aceptan desde afuera")
    void validaLaCategoriaDelMovimiento() {
        assertThatThrownBy(() -> cajaService.registrarMovimiento(devolucion(null, TipoMovimiento.EGRESO), 5L))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> cajaService.registrarMovimiento(devolucion(42L, TipoMovimiento.INGRESO), 5L))
                .isInstanceOf(IllegalArgumentException.class);
        MovimientoCajaRequest venta = devolucion(42L, TipoMovimiento.INGRESO);
        venta.setCategoria(CategoriaMovimiento.VENTA);
        assertThatThrownBy(() -> cajaService.registrarMovimiento(venta, 5L))
                .isInstanceOf(IllegalArgumentException.class);
        verify(movimientoRepository, never()).saveAndFlush(any());
        verify(movimientoRepository, never()).save(any());
    }
}
