package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Stock por producto: se descuenta al pedir, se rechaza si no alcanza y vuelve al cancelar. */
@ExtendWith(MockitoExtension.class)
class OrdenStockTest {

    @Mock private OrdenRepository ordenRepository;
    @Mock private ProductoService productoService;
    @Mock private MesaService mesaService;
    @Mock private NotificationService notificationService;
    @Mock private SalonEventPublisher salonEventPublisher;
    @Mock private NumeroPedidoService numeroPedidoService;
    @Mock private SancionDispatcherService sancionDispatcherService;

    @InjectMocks
    private OrdenService ordenService;

    private Producto pollo;

    @BeforeEach
    void setUp() {
        pollo = Producto.builder().id(10L).nombre("Pollo entero")
                .precio(new BigDecimal("60.00")).disponible(true).stock(40).build();
        lenient().when(productoService.buscarConBloqueo(10L)).thenReturn(pollo);
    }

    @Test
    void pedirMasDeLoQueQuedaSeRechazaConMensajeClaro() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(recojo(100), 0L));

        assertEquals("No hay stock suficiente de 'Pollo entero': pediste 100 y solo quedan 40.", e.getMessage());
        assertEquals(40, pollo.getStock());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void pedirDescuentaElStock() {
        ordenService.crear(recojo(15), 0L);

        assertEquals(25, pollo.getStock());
        assertTrue(pollo.isDisponible());
    }

    @Test
    void venderLaUltimaUnidadDejaElProductoAgotado() {
        ordenService.crear(recojo(40), 0L);

        assertEquals(0, pollo.getStock());
        assertFalse(pollo.isDisponible());
    }

    @Test
    void dosLineasDelMismoProductoSumanContraElStock() {
        CrearOrdenRequest req = recojo(30);
        req.setItems(List.of(item(30), item(30)));

        assertThrows(IllegalArgumentException.class, () -> ordenService.crear(req, 0L));
    }

    @Test
    void productoSinControlDeStockNoSeLimita() {
        pollo.setStock(null);

        ordenService.crear(recojo(100), 0L);

        assertNull(pollo.getStock());
    }

    @Test
    void cancelarAntesDeCocinaDevuelveElStock() {
        pollo.setStock(25);
        Orden orden = ordenConPollo(OrdenEstado.RECIBIDO, 15);
        when(ordenRepository.findById(1L)).thenReturn(Optional.of(orden));

        ordenService.actualizarEstado(1L, cancelar(), 0L);

        assertEquals(40, pollo.getStock());
    }

    @Test
    void cancelarConElPolloYaEnPreparacionNoDevuelveElStock() {
        pollo.setStock(25);
        Orden orden = ordenConPollo(OrdenEstado.EN_PREPARACION, 15);
        when(ordenRepository.findById(1L)).thenReturn(Optional.of(orden));

        ordenService.actualizarEstado(1L, cancelar(), 0L);

        assertEquals(25, pollo.getStock());
    }

    private CrearOrdenRequest recojo(int cantidad) {
        CrearOrdenRequest req = new CrearOrdenRequest();
        req.setTipo(OrdenTipo.RECOJO);
        req.setNombreCliente("Cliente");
        req.setItems(List.of(item(cantidad)));
        return req;
    }

    private OrdenItemRequest item(int cantidad) {
        OrdenItemRequest item = new OrdenItemRequest();
        item.setProductoId(10L);
        item.setCantidad(cantidad);
        return item;
    }

    private Orden ordenConPollo(OrdenEstado estado, int cantidad) {
        Orden orden = Orden.builder().id(1L).tipo(OrdenTipo.RECOJO).estado(estado)
                .items(new ArrayList<>()).build();
        orden.getItems().add(OrdenItem.builder().orden(orden).producto(pollo).cantidad(cantidad)
                .precioUnitario(pollo.getPrecio()).subtotal(pollo.getPrecio()).build());
        return orden;
    }

    private ActualizarEstadoRequest cancelar() {
        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.CANCELADO);
        return req;
    }
}
