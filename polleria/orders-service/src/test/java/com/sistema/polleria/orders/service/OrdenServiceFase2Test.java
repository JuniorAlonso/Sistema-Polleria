package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrdenServiceFase2Test {

    @Mock
    private OrdenRepository ordenRepository;

    @Mock
    private ProductoService productoService;

    @Mock
    private MesaService mesaService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private SalonEventPublisher salonEventPublisher;

    @Mock
    private NumeroPedidoService numeroPedidoService;

    @InjectMocks
    private OrdenService ordenService;

    private Mesa mesa;
    private Producto producto;

    @BeforeEach
    void setUp() {
        mesa = Mesa.builder()
                .id(1L)
                .numero(3)
                .capacidad(4)
                .estado(MesaEstado.LIBRE)
                .build();

        producto = Producto.builder()
                .id(10L)
                .nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00"))
                .disponible(true)
                .build();
    }

    @Test
    void testCrearOrdenSalonOcupaMesaYDisparaStomp() {
        CrearOrdenRequest req = new CrearOrdenRequest();
        req.setTipo(OrdenTipo.SALON);
        req.setMesaId(1L);
        req.setNombreCliente("Carlos Mozo");
        OrdenItemRequest itemReq = new OrdenItemRequest();
        itemReq.setProductoId(10L);
        itemReq.setCantidad(2);
        req.setItems(List.of(itemReq));

        when(mesaService.buscarOFallarConBloqueo(1L)).thenReturn(mesa);
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(1L), anyList())).thenReturn(List.of());
        when(productoService.buscarOFallar(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenAnswer(i -> {
            Orden o = i.getArgument(0);
            o.setId(100L);
            return o;
        });
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesa));

        var response = ordenService.crear(req, 5L);

        assertNotNull(response);
        assertEquals(MesaEstado.OCUPADA, mesa.getEstado());
        verify(salonEventPublisher).notificarNuevaComanda(any(Orden.class));
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    // S4.1 — la comanda de salón queda registrada con clienteId y mozoId = usuario del token
    @Test
    void testCrearOrdenSalonGuardaClienteYMozoConElUsuarioAutenticado() {
        CrearOrdenRequest req = new CrearOrdenRequest();
        req.setTipo(OrdenTipo.SALON);
        req.setMesaId(1L);
        OrdenItemRequest itemReq = new OrdenItemRequest();
        itemReq.setProductoId(10L);
        itemReq.setCantidad(1);
        req.setItems(List.of(itemReq));

        when(mesaService.buscarOFallarConBloqueo(1L)).thenReturn(mesa);
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(1L), anyList())).thenReturn(List.of());
        when(productoService.buscarOFallar(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenAnswer(i -> {
            Orden o = i.getArgument(0);
            o.setId(101L);
            return o;
        });
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesa));

        ordenService.crear(req, 5L);

        ArgumentCaptor<Orden> captor = ArgumentCaptor.forClass(Orden.class);
        verify(ordenRepository).save(captor.capture());
        assertEquals(5L, captor.getValue().getClienteId(), "clienteId registra al usuario que tomó la comanda");
        assertEquals(5L, captor.getValue().getMozoId(), "mozoId debe registrar al mozo real");
    }

    // PRESERVE — el flujo de delivery no cambia: sigue sin registrar mozoId.
    @Test
    void testCrearOrdenDeliveryNoRegistraMozo() {
        CrearOrdenRequest req = new CrearOrdenRequest();
        req.setTipo(OrdenTipo.DELIVERY);
        req.setDireccionEntrega("Av. Prueba 123");
        req.setNombreCliente("Cliente Delivery");
        req.setTelefonoCliente("911111111");
        OrdenItemRequest itemReq = new OrdenItemRequest();
        itemReq.setProductoId(10L);
        itemReq.setCantidad(1);
        req.setItems(List.of(itemReq));

        when(productoService.buscarOFallar(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenAnswer(i -> {
            Orden o = i.getArgument(0);
            o.setId(102L);
            return o;
        });

        ordenService.crear(req, 5L);

        ArgumentCaptor<Orden> captor = ArgumentCaptor.forClass(Orden.class);
        verify(ordenRepository).save(captor.capture());
        assertEquals(5L, captor.getValue().getClienteId());
        assertNull(captor.getValue().getMozoId(), "delivery no lleva mozo");
    }

    @Test
    void testActualizarEstadoAListoDisparaNotificacionCocinaMozo() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .mesa(mesa)
                .estado(OrdenEstado.EN_PREPARACION)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesa));

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.LISTO);

        ordenService.actualizarEstado(100L, req, 2L);

        assertEquals(OrdenEstado.LISTO, orden.getEstado());
        verify(salonEventPublisher).notificarPedidoListo(orden);
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testActualizarEstadoAEntregadoLiberaMesa() {
        mesa.setEstado(MesaEstado.OCUPADA);
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .mesa(mesa)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesa));

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.ENTREGADO);

        ordenService.actualizarEstado(100L, req, 2L);

        assertEquals(OrdenEstado.ENTREGADO, orden.getEstado());
        assertEquals(MesaEstado.LIBRE, mesa.getEstado());
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }
}
