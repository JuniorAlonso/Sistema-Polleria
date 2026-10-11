package com.sistema.polleria.feedback.service;

import com.sistema.polleria.feedback.dto.CrearReseniaRequest;
import com.sistema.polleria.feedback.dto.ProductoReseniasResponse;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.entity.Resenia;
import com.sistema.polleria.feedback.repository.ReseniaRepository;
import org.junit.jupiter.api.BeforeEach;
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
class ReseniaServiceTest {

    @Mock
    private ReseniaRepository reseniaRepository;

    @InjectMocks
    private ReseniaService reseniaService;

    private CrearReseniaRequest request;

    @BeforeEach
    void setUp() {
        request = CrearReseniaRequest.builder()
                .ordenId(10L)
                .calificacion(5)
                .comentario("Excelente sabor y rapidez")
                .build();
    }

    @Test
    void testCrearReseniaExitoso() {
        when(reseniaRepository.existsByOrdenIdAndClienteId(10L, 1L)).thenReturn(false);
        when(reseniaRepository.save(any(Resenia.class))).thenAnswer(i -> {
            Resenia r = i.getArgument(0);
            r.setId(100L);
            return r;
        });

        ReseniaResponse response = reseniaService.crear(request, 1L);

        assertNotNull(response);
        assertEquals(10L, response.getOrdenId());
        assertEquals(5, response.getCalificacion());
        assertEquals("Excelente sabor y rapidez", response.getComentario());
        verify(reseniaRepository).save(any(Resenia.class));
    }

    @Test
    void testCrearReseniaDuplicadaLanzaError() {
        when(reseniaRepository.existsByOrdenIdAndClienteId(10L, 1L)).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> reseniaService.crear(request, 1L));

        assertTrue(ex.getMessage().contains("Ya existe una reseña"));
        verify(reseniaRepository, never()).save(any());
    }

    @Test
    void testObtenerResumenProductoCalculaPromedio() {
        Resenia r1 = Resenia.builder().id(1L).calificacion(5).build();
        Resenia r2 = Resenia.builder().id(2L).calificacion(4).build();
        when(reseniaRepository.findAllByOrderByCreadoEnDesc()).thenReturn(List.of(r1, r2));

        ProductoReseniasResponse response = reseniaService.obtenerResumenProducto(3L);

        assertEquals(3L, response.getProductoId());
        assertEquals(4.5, response.getPromedioCalificacion());
        assertEquals(2, response.getTotalResenias());
    }
}
