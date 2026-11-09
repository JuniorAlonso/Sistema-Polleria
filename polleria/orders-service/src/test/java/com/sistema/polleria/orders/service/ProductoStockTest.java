package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ProductoRequest;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Producto;
import com.sistema.polleria.orders.repository.ProductoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** A dish with no units left cannot be shown as available: every order would be rejected. */
@ExtendWith(MockitoExtension.class)
class ProductoStockTest {

    @Mock private ProductoRepository productoRepository;

    @InjectMocks
    private ProductoService productoService;

    private Producto pollo;

    @BeforeEach
    void setUp() {
        pollo = Producto.builder().id(10L).nombre("Pollo entero").categoria(Categoria.POLLO_ENTERO)
                .precio(new BigDecimal("60.00")).disponible(false).stock(0).build();
        lenient().when(productoRepository.findById(10L)).thenReturn(Optional.of(pollo));
    }

    @Test
    void noSePuedeActivarUnPlatoSinStock() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> productoService.toggleDisponibilidad(10L));

        assertEquals("'Pollo entero' no tiene stock: repón unidades antes de activarlo.", e.getMessage());
        assertFalse(pollo.isDisponible());
        verify(productoRepository, never()).save(any());
    }

    @Test
    void unPlatoSinControlDeStockSeActivaYDesactivaLibremente() {
        pollo.setStock(null);

        productoService.toggleDisponibilidad(10L);

        assertTrue(pollo.isDisponible());
    }

    @Test
    void unPlatoConStockSeDesactivaAMano() {
        pollo.setStock(5);
        pollo.setDisponible(true);

        productoService.toggleDisponibilidad(10L);

        assertFalse(pollo.isDisponible());
        assertEquals(5, pollo.getStock());
    }

    @Test
    void editarUnPlatoSinStockNoLoVuelveDisponible() {
        ProductoRequest req = new ProductoRequest();
        req.setNombre("Pollo entero");
        req.setPrecio(new BigDecimal("62.00"));
        req.setCategoria(Categoria.POLLO_ENTERO);
        req.setDisponible(true);

        productoService.actualizar(10L, req);

        assertFalse(pollo.isDisponible());
        assertEquals(new BigDecimal("62.00"), pollo.getPrecio());
    }
}
