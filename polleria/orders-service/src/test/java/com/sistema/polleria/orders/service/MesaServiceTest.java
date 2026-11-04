package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarMesaRequest;
import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenActivaResponse;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.MesaRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MesaServiceTest {

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private OrdenRepository ordenRepository;

    @Mock
    private SalonEventPublisher salonEventPublisher;

    @InjectMocks
    private MesaService mesaService;

    private Mesa mesaLibre;
    private Mesa mesaOcupada;

    @BeforeEach
    void setUp() {
        mesaLibre = Mesa.builder()
                .id(1L)
                .numero(1)
                .capacidad(4)
                .estado(MesaEstado.LIBRE)
                .posicionX(10)
                .posicionY(20)
                .zona("SALON_PRINCIPAL")
                .activo(true)
                .build();

        mesaOcupada = Mesa.builder()
                .id(2L)
                .numero(2)
                .capacidad(6)
                .estado(MesaEstado.OCUPADA)
                .posicionX(50)
                .posicionY(60)
                .zona("SALON_PRINCIPAL")
                .activo(true)
                .build();
    }

    @Test
    void testCrearMesaConCoordenadasYZona() {
        when(mesaRepository.existsByNumero(5)).thenReturn(false);
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        MesaResponse response = mesaService.crear(5, 4, 100, 150, "TERRAZA");

        assertNotNull(response);
        assertEquals(5, response.getNumero());
        assertEquals(4, response.getCapacidad());
        assertEquals(100, response.getPosicionX());
        assertEquals(150, response.getPosicionY());
        assertEquals("TERRAZA", response.getZona());
        assertEquals(MesaEstado.LIBRE, response.getEstado());
        assertTrue(response.getActivo());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testCrearMesaDuplicadaLanzaExcepcion() {
        when(mesaRepository.existsByNumero(1)).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> mesaService.crear(1, 4, 0, 0));
        verify(mesaRepository, never()).save(any());
    }

    @Test
    void testActualizarPosicionMesa() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        MesaResponse response = mesaService.actualizarPosicion(1L, 200, 300);

        assertEquals(200, response.getPosicionX());
        assertEquals(300, response.getPosicionY());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testActualizarEstadoMesaTransicionValida() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        // LIBRE -> OCUPADA es válida
        MesaResponse response = mesaService.actualizarEstado(1L, MesaEstado.OCUPADA);

        assertEquals(MesaEstado.OCUPADA, response.getEstado());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testActualizarEstadoMesaTransicionInvalidaRechazada() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));

        // LIBRE -> POR_COBRAR es inválida en la máquina de estados
        assertThrows(IllegalStateException.class, () -> mesaService.actualizarEstado(1L, MesaEstado.POR_COBRAR));
        verify(mesaRepository, never()).save(any());
    }

    @Test
    void testActualizarEstadoMesaTransicionForzadaPermitida() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        // LIBRE -> POR_COBRAR con forzar=true
        MesaResponse response = mesaService.actualizarEstado(1L, MesaEstado.POR_COBRAR, true);

        assertEquals(MesaEstado.POR_COBRAR, response.getEstado());
        verify(mesaRepository).save(any());
    }

    @Test
    void testActualizarMesaCrudAdmin() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(mesaRepository.existsByNumeroAndIdNot(10, 1L)).thenReturn(false);
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        ActualizarMesaRequest req = ActualizarMesaRequest.builder()
                .numero(10)
                .capacidad(8)
                .zona("TERRAZA")
                .posicionX(15)
                .posicionY(25)
                .activo(true)
                .build();

        MesaResponse response = mesaService.actualizarMesa(1L, req);

        assertNotNull(response);
        assertEquals(10, mesaLibre.getNumero());
        assertEquals(8, mesaLibre.getCapacidad());
        assertEquals("TERRAZA", mesaLibre.getZona());
        assertEquals(15, mesaLibre.getPosicionX());
        assertEquals(25, mesaLibre.getPosicionY());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testEliminarMesaConOrdenActivaLanzaExcepcion() {
        when(mesaRepository.findById(2L)).thenReturn(Optional.of(mesaOcupada));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(2L), anyList()))
                .thenReturn(List.of(Orden.builder().id(99L).build()));

        assertThrows(IllegalStateException.class, () -> mesaService.eliminar(2L));
        assertTrue(mesaOcupada.getActivo());
    }

    @Test
    void testEliminarMesaSinOrdenActivaAplicaSoftDelete() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(1L), anyList()))
                .thenReturn(List.of());
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        mesaService.eliminar(1L);

        assertFalse(mesaLibre.getActivo());
        verify(mesaRepository).save(mesaLibre);
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    // S4.2 — liberar una mesa con comanda activa dejaría la comanda huérfana: se rechaza con 409
    @Test
    void testLiberarMesaConComandaActivaLanzaConflicto() {
        when(mesaRepository.findById(2L)).thenReturn(Optional.of(mesaOcupada));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(2L), anyList()))
                .thenReturn(List.of(Orden.builder().id(99L).estado(OrdenEstado.EN_PREPARACION).build()));

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> mesaService.actualizarEstado(2L, MesaEstado.LIBRE));

        assertTrue(ex.getMessage().contains("2"), "el mensaje debe nombrar la mesa: " + ex.getMessage());
        assertTrue(ex.getMessage().contains("99"), "el mensaje debe nombrar la comanda: " + ex.getMessage());
        assertTrue(ex.getMessage().contains("EN_PREPARACION"), "el mensaje debe dar el estado: " + ex.getMessage());
        assertEquals(MesaEstado.OCUPADA, mesaOcupada.getEstado(), "la mesa conserva su estado");
        verify(mesaRepository, never()).save(any());
    }

    @Test
    void testPasarMesaAEnLimpiezaConComandaActivaLanzaConflicto() {
        when(mesaRepository.findById(2L)).thenReturn(Optional.of(mesaOcupada));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(2L), anyList()))
                .thenReturn(List.of(Orden.builder().id(99L).estado(OrdenEstado.LISTO).build()));

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> mesaService.actualizarEstado(2L, MesaEstado.EN_LIMPIEZA));

        assertTrue(ex.getMessage().contains("99"), "el mensaje debe nombrar la comanda: " + ex.getMessage());
        assertEquals(MesaEstado.OCUPADA, mesaOcupada.getEstado());
        verify(mesaRepository, never()).save(any());
    }

    @Test
    void testLiberarMesaConComandaActivaForzadaPermite() {
        when(mesaRepository.findById(2L)).thenReturn(Optional.of(mesaOcupada));
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaOcupada);

        MesaResponse response = mesaService.actualizarEstado(2L, MesaEstado.LIBRE, true);

        assertEquals(MesaEstado.LIBRE, response.getEstado());
        verify(mesaRepository).save(mesaOcupada);
        verify(ordenRepository, never()).findByMesaIdAndEstadoNotIn(anyLong(), anyList());
    }

    @Test
    void testLiberarMesaSinComandaActivaMantieneComportamientoPrevio() {
        when(mesaRepository.findById(2L)).thenReturn(Optional.of(mesaOcupada));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(2L), anyList())).thenReturn(List.of());
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaOcupada);

        MesaResponse response = mesaService.actualizarEstado(2L, MesaEstado.LIBRE);

        assertEquals(MesaEstado.LIBRE, response.getEstado());
        verify(mesaRepository).save(mesaOcupada);
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testOrdenActivaPrefiereMozoIdYcaeAClienteId() {
        Mesa mesaTres = Mesa.builder()
                .id(3L)
                .numero(3)
                .capacidad(2)
                .estado(MesaEstado.OCUPADA)
                .activo(true)
                .build();

        Orden conMozo = Orden.builder()
                .id(46L)
                .clienteId(3L)
                .mozoId(7L)
                .mesa(mesaOcupada)
                .total(new BigDecimal("10.00"))
                .estado(OrdenEstado.RECIBIDO)
                .build();

        Orden sinMozo = Orden.builder()
                .id(47L)
                .clienteId(9L)
                .mesa(mesaTres)
                .total(new BigDecimal("10.00"))
                .estado(OrdenEstado.RECIBIDO)
                .build();

        when(mesaRepository.findByActivoTrueOrderByNumeroAsc()).thenReturn(List.of(mesaOcupada, mesaTres));
        when(ordenRepository.findByMesaIdInAndEstadoNotIn(anyList(), anyList()))
                .thenReturn(List.of(conMozo, sinMozo));

        List<MesaResponse> result = mesaService.listarTodas();

        assertEquals(7L, result.get(0).getOrdenActiva().getMozoId(),
                "mozoId debe ser el mozo real de la comanda");
        assertEquals(9L, result.get(1).getOrdenActiva().getMozoId(),
                "sin mozoId registrado se conserva el fallback a clienteId");
    }

    @Test
    void testListarMesaOcupadaEnriqueceConOrdenActiva() {
        Orden ordenActiva = Orden.builder()
                .id(45L)
                .clienteId(3L)
                .mesa(mesaOcupada)
                .total(new BigDecimal("75.50"))
                .estado(OrdenEstado.EN_PREPARACION)
                .creadoEn(LocalDateTime.now().minusMinutes(15))
                .build();

        when(mesaRepository.findByActivoTrueOrderByNumeroAsc()).thenReturn(List.of(mesaOcupada));
        when(ordenRepository.findByMesaIdInAndEstadoNotIn(anyList(), anyList()))
                .thenReturn(List.of(ordenActiva));

        List<MesaResponse> result = mesaService.listarTodas();

        assertEquals(1, result.size());
        MesaResponse mesaDto = result.get(0);
        assertEquals(2, mesaDto.getNumero());
        assertNotNull(mesaDto.getOrdenActiva());
        assertEquals(45L, mesaDto.getOrdenActiva().getOrdenId());
        assertEquals(OrdenEstado.EN_PREPARACION, mesaDto.getOrdenActiva().getEstadoOrden());
        assertEquals(new BigDecimal("75.50"), mesaDto.getOrdenActiva().getTotal());
    }

    // N+1: listar el salón debe hacer UNA consulta de comandas activas, no una por mesa.
    @Test
    void testListarTodasHaceUnaSolaConsultaDeComandasActivas() {
        Mesa mesaTres = Mesa.builder()
                .id(3L)
                .numero(3)
                .capacidad(2)
                .estado(MesaEstado.OCUPADA)
                .activo(true)
                .build();

        Orden enMesaDos = Orden.builder()
                .id(50L)
                .mesa(mesaOcupada)
                .total(new BigDecimal("10.00"))
                .estado(OrdenEstado.EN_PREPARACION)
                .build();
        Orden enMesaTres = Orden.builder()
                .id(51L)
                .mesa(mesaTres)
                .total(new BigDecimal("20.00"))
                .estado(OrdenEstado.LISTO)
                .build();

        when(mesaRepository.findByActivoTrueOrderByNumeroAsc())
                .thenReturn(List.of(mesaOcupada, mesaTres));
        when(ordenRepository.findByMesaIdInAndEstadoNotIn(anyList(), anyList()))
                .thenReturn(List.of(enMesaDos, enMesaTres));

        List<MesaResponse> result = mesaService.listarTodas();

        assertEquals(2, result.size());
        assertNotNull(result.get(0).getOrdenActiva());
        assertNotNull(result.get(1).getOrdenActiva());
        verify(ordenRepository, times(1)).findByMesaIdInAndEstadoNotIn(anyList(), anyList());
        verify(ordenRepository, never()).findByMesaIdAndEstadoNotIn(anyLong(), anyList());
    }
}
