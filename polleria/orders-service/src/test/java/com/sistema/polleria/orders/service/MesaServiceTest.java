package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
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
                .build();

        mesaOcupada = Mesa.builder()
                .id(2L)
                .numero(2)
                .capacidad(6)
                .estado(MesaEstado.OCUPADA)
                .posicionX(50)
                .posicionY(60)
                .build();
    }

    @Test
    void testCrearMesaConCoordenadas() {
        when(mesaRepository.existsByNumero(5)).thenReturn(false);
        when(mesaRepository.save(any(Mesa.class))).thenAnswer(i -> i.getArgument(0));

        MesaResponse response = mesaService.crear(5, 4, 100, 150);

        assertNotNull(response);
        assertEquals(5, response.getNumero());
        assertEquals(4, response.getCapacidad());
        assertEquals(100, response.getPosicionX());
        assertEquals(150, response.getPosicionY());
        assertEquals(MesaEstado.LIBRE, response.getEstado());
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
    void testActualizarEstadoMesa() {
        when(mesaRepository.findById(1L)).thenReturn(Optional.of(mesaLibre));
        when(mesaRepository.save(any(Mesa.class))).thenReturn(mesaLibre);

        MesaResponse response = mesaService.actualizarEstado(1L, MesaEstado.POR_COBRAR);

        assertEquals(MesaEstado.POR_COBRAR, response.getEstado());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testListarMesaOcupadaEnriqueceConOrdenActiva() {
        Orden ordenActiva = Orden.builder()
                .id(45L)
                .clienteId(3L)
                .total(new BigDecimal("75.50"))
                .estado(OrdenEstado.EN_PREPARACION)
                .creadoEn(LocalDateTime.now().minusMinutes(15))
                .build();

        when(mesaRepository.findAll()).thenReturn(List.of(mesaOcupada));
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(2L), anyList())).thenReturn(List.of(ordenActiva));

        List<MesaResponse> result = mesaService.listarTodas();

        assertEquals(1, result.size());
        MesaResponse mesaDto = result.get(0);
        assertEquals(2, mesaDto.getNumero());
        assertNotNull(mesaDto.getOrdenActiva());
        assertEquals(45L, mesaDto.getOrdenActiva().getOrdenId());
        assertEquals(OrdenEstado.EN_PREPARACION, mesaDto.getOrdenActiva().getEstadoOrden());
        assertEquals(new BigDecimal("75.50"), mesaDto.getOrdenActiva().getTotal());
    }
}
