package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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

    // S4.3 — segunda ronda: misma comanda, total recalculado, evento de cocina
    @Test
    void testAgregarItemsSumaALaComandaExistenteYEmiteEventoDeCocina() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(100L, mesaComanda, OrdenEstado.RECIBIDO, 1);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(2);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarOFallar(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        var response = ordenService.agregarItems(100L, List.of(nuevo), 2L);

        assertEquals(2, response.getItems().size(), "la misma comanda suma el ítem nuevo");
        assertEquals(new BigDecimal("66.00"), response.getTotal(), "total = suma de subtotales");
        assertEquals(OrdenEstado.RECIBIDO, orden.getEstado(), "una comanda en curso no cambia de estado");
        verify(ordenRepository, times(1)).save(orden);
        verify(salonEventPublisher).notificarNuevaComanda(orden);
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testAgregarItemsAComandaListoLaDevuelveAEnPreparacion() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(100L, mesaComanda, OrdenEstado.LISTO, 1);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarOFallar(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        ordenService.agregarItems(100L, List.of(nuevo), 2L);

        assertEquals(OrdenEstado.EN_PREPARACION, orden.getEstado(),
                "la nueva ronda debe volver a pasar por cocina");
        verify(salonEventPublisher).notificarNuevaComanda(orden);
    }

    @Test
    void testAgregarItemsAComandaEntregadaLanzaConflicto() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.ENTREGADO)
                .items(new ArrayList<>())
                .build();

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.agregarItems(100L, List.of(nuevo), 2L));

        assertTrue(ex.getMessage().contains("100"), "el mensaje debe nombrar la comanda: " + ex.getMessage());
        assertTrue(ex.getMessage().contains("ENTREGADO"), "el mensaje debe dar el estado: " + ex.getMessage());
        verify(ordenRepository, never()).save(any());
        verify(salonEventPublisher, never()).notificarNuevaComanda(any());
    }

    @Test
    void testAgregarItemsAOrdenDeliveryLanzaIllegalArgument() {
        Orden orden = Orden.builder()
                .id(200L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.RECIBIDO)
                .items(new ArrayList<>())
                .build();

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(200L)).thenReturn(Optional.of(orden));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> ordenService.agregarItems(200L, List.of(nuevo), 2L));

        assertTrue(ex.getMessage().contains("Solo las comandas de salón"), ex.getMessage());
        assertTrue(ex.getMessage().contains("DELIVERY"), ex.getMessage());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testAgregarItemsConProductoAgotadoLanzaIllegalArgument() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(100L, mesaComanda, OrdenEstado.RECIBIDO, 1);
        producto.setDisponible(false);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarOFallar(10L)).thenReturn(producto);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> ordenService.agregarItems(100L, List.of(nuevo), 2L));

        assertTrue(ex.getMessage().contains("está agotado"), ex.getMessage());
        verify(ordenRepository, never()).save(any());
    }

    // S3.1 — «el mozo ya entregó el pedido en mesa» como marca persistida, sin estado nuevo
    @Test
    void testMarcarServidoRegistraMarcaYConservaElEstadoListo() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(100L, mesaComanda, OrdenEstado.LISTO, 1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        var response = ordenService.marcarServido(100L, 2L);

        assertNotNull(orden.getServidoEn(), "la marca de servido debe quedar en la orden");
        assertEquals(2L, orden.getServidoPor(), "se registra quién la sirvió");
        assertNotNull(response.getServidoEn());
        assertEquals(2L, response.getServidoPor());
        assertEquals(OrdenEstado.LISTO, orden.getEstado(), "servir no cambia la máquina de estados");
        verify(ordenRepository, times(1)).save(orden);
        verify(salonEventPublisher).notificarMesaActualizada(any(MesaResponse.class));
    }

    @Test
    void testMarcarServidoEsIdempotenteYNoPisaLaPrimeraMarca() {
        LocalDateTime primera = LocalDateTime.now().minusMinutes(5);
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.LISTO)
                .servidoEn(primera)
                .servidoPor(2L)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));

        var response = ordenService.marcarServido(100L, 9L);

        assertEquals(primera, orden.getServidoEn(), "una segunda llamada no reescribe la marca");
        assertEquals(2L, orden.getServidoPor());
        assertEquals(primera, response.getServidoEn());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testMarcarServidoAntesDeListoLanzaConflicto() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.EN_PREPARACION)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.marcarServido(100L, 2L));

        assertTrue(ex.getMessage().contains("100"), ex.getMessage());
        assertTrue(ex.getMessage().contains("EN_PREPARACION"), ex.getMessage());
        assertNull(orden.getServidoEn());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testMarcarServidoUnaComandaEntregadaLanzaConflicto() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.ENTREGADO)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.marcarServido(100L, 2L));

        assertTrue(ex.getMessage().contains("ENTREGADO"), ex.getMessage());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testMarcarServidoUnaOrdenDeliveryLanzaIllegalArgument() {
        Orden orden = Orden.builder()
                .id(200L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.buscarConBloqueo(200L)).thenReturn(Optional.of(orden));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> ordenService.marcarServido(200L, 2L));

        assertTrue(ex.getMessage().contains("Solo las comandas de salón"), ex.getMessage());
        verify(ordenRepository, never()).save(any());
    }

    /** Comanda de salón con {@code cantidadPrevia} unidades de {@link #producto} ya cargadas. */
    private Orden comandaDeSalon(Long id, Mesa mesaComanda, OrdenEstado estado, int cantidadPrevia) {
        Orden orden = Orden.builder()
                .id(id)
                .tipo(OrdenTipo.SALON)
                .mesa(mesaComanda)
                .estado(estado)
                .items(new ArrayList<>())
                .build();
        orden.getItems().add(OrdenItem.builder()
                .orden(orden)
                .producto(producto)
                .cantidad(cantidadPrevia)
                .precioUnitario(producto.getPrecio())
                .subtotal(producto.getPrecio().multiply(BigDecimal.valueOf(cantidadPrevia)))
                .build());
        orden.recalcularTotal();
        return orden;
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

    @Test
    void testCrearSalonEnMesaEnLimpiezaLanzaConflicto() {
        mesa.setEstado(MesaEstado.EN_LIMPIEZA);
        CrearOrdenRequest req = new CrearOrdenRequest();
        req.setTipo(OrdenTipo.SALON);
        req.setMesaId(1L);
        OrdenItemRequest itemReq = new OrdenItemRequest();
        itemReq.setProductoId(10L);
        itemReq.setCantidad(1);
        req.setItems(List.of(itemReq));

        when(mesaService.buscarOFallarConBloqueo(1L)).thenReturn(mesa);

        assertThrows(ConflictoDeEstadoException.class, () -> ordenService.crear(req, 2L));
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testDeliveryEnCaminoSinRepartidorLanzaIllegalArgument() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.EN_CAMINO);

        assertThrows(IllegalArgumentException.class,
                () -> ordenService.actualizarEstado(100L, req, 2L));
        assertEquals(OrdenEstado.LISTO, orden.getEstado(), "el estado no debe cambiar");
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void testDeliveryEnCaminoConRepartidorAsignaElMotorizado() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.EN_CAMINO);
        req.setRepartidorId(4L);

        ordenService.actualizarEstado(100L, req, 2L);

        assertEquals(OrdenEstado.EN_CAMINO, orden.getEstado());
        assertEquals(4L, orden.getRepartidorId());
        verify(ordenRepository).save(orden);
    }

    @Test
    void testSalonNoGuardaRepartidorAunqueLoEnvieElRequest() {
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.ENTREGADO);
        req.setRepartidorId(9L);

        ordenService.actualizarEstado(100L, req, 2L);

        assertEquals(OrdenEstado.ENTREGADO, orden.getEstado());
        assertNull(orden.getRepartidorId(), "SALON no lleva repartidor");
    }
}
