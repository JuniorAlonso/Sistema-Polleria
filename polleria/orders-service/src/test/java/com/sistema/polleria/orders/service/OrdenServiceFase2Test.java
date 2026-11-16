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

    @Mock
    private SancionDispatcherService sancionDispatcherService;

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
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
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
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
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

        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
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
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
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
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        ordenService.agregarItems(100L, List.of(nuevo), 2L);

        assertEquals(OrdenEstado.EN_PREPARACION, orden.getEstado(),
                "la nueva ronda debe volver a pasar por cocina");
        verify(salonEventPublisher).notificarNuevaComanda(orden);
    }

    // F-03: agregar una nueva ronda limpia servidoEn y servidoPor y permite volver a servir
    @Test
    void testAgregarItemsLimpiaServidoEnYServidoPorYPuedeVolverAServirse() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(100L, mesaComanda, OrdenEstado.LISTO, 1);
        LocalDateTime primerServido = LocalDateTime.now().minusMinutes(10);
        orden.setServidoEn(primerServido);
        orden.setServidoPor(2L);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        var trasRonda = ordenService.agregarItems(100L, List.of(nuevo), 2L);

        assertNull(orden.getServidoEn(), "agregar nueva ronda debe limpiar servidoEn");
        assertNull(orden.getServidoPor(), "agregar nueva ronda debe limpiar servidoPor");
        assertNull(trasRonda.getServidoEn());
        assertNull(trasRonda.getServidoPor());
        assertEquals(OrdenEstado.EN_PREPARACION, orden.getEstado());

        // Mientras la segunda ronda está en preparación, no puede marcarse como servida
        assertThrows(ConflictoDeEstadoException.class, () -> ordenService.marcarServido(100L, 5L));

        // Cuando cocina marca LISTO la nueva ronda, el mozo puede volver a servirla
        orden.setEstado(OrdenEstado.LISTO);
        var servidaSegundaRonda = ordenService.marcarServido(100L, 5L);

        assertNotNull(orden.getServidoEn(), "la segunda ronda debe registrar su propia marca de servido");
        assertEquals(5L, orden.getServidoPor());
        assertNotNull(servidaSegundaRonda.getServidoEn());
        assertEquals(5L, servidaSegundaRonda.getServidoPor());
    }

    // F-04: agregar productos cuando la mesa está en POR_COBRAR devuelve la mesa a OCUPADA
    @Test
    void testAgregarItemsConMesaPorCobrarDevuelveMesaAOcupada() {
        Mesa mesaPorCobrar = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.POR_COBRAR).build();
        Orden orden = comandaDeSalon(100L, mesaPorCobrar, OrdenEstado.LISTO, 1);
        orden.setServidoEn(LocalDateTime.now().minusMinutes(5));
        orden.setServidoPor(2L);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaPorCobrar));

        ordenService.agregarItems(100L, List.of(nuevo), 2L);

        assertEquals(MesaEstado.OCUPADA, mesaPorCobrar.getEstado(),
                "la mesa en POR_COBRAR debe volver a OCUPADA al recibir una nueva ronda");
        assertEquals(OrdenEstado.EN_PREPARACION, orden.getEstado(),
                "la comanda LISTO debe volver a EN_PREPARACION");
        assertNull(orden.getServidoEn(), "servidoEn debe limpiarse");
        assertNull(orden.getServidoPor(), "servidoPor debe limpiarse");
    }

    @Test
    void testAgregarItemsCuandoFallaValidacionNoAlteraEstadoDeMesaNiServidoEn() {
        LocalDateTime servidoPrevio = LocalDateTime.now().minusMinutes(5);
        Mesa mesaPorCobrar = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.POR_COBRAR).build();
        Orden orden = comandaDeSalon(100L, mesaPorCobrar, OrdenEstado.LISTO, 1);
        orden.setServidoEn(servidoPrevio);
        orden.setServidoPor(2L);
        producto.setDisponible(false);

        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);

        assertThrows(IllegalArgumentException.class,
                () -> ordenService.agregarItems(100L, List.of(nuevo), 2L));

        assertEquals(MesaEstado.POR_COBRAR, mesaPorCobrar.getEstado());
        assertEquals(OrdenEstado.LISTO, orden.getEstado());
        assertEquals(servidoPrevio, orden.getServidoEn());
        assertEquals(2L, orden.getServidoPor());
        verify(ordenRepository, never()).save(any());
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
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);

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
        mesa.setEstado(MesaEstado.POR_COBRAR);
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
    void testActualizarEstadoAEntregadoConMesaOcupadaLanzaConflicto() {
        mesa.setEstado(MesaEstado.OCUPADA);
        Orden orden = Orden.builder()
                .id(100L)
                .tipo(OrdenTipo.SALON)
                .mesa(mesa)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();

        when(ordenRepository.findById(100L)).thenReturn(Optional.of(orden));

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.ENTREGADO);

        assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(100L, req, 2L));
        assertEquals(OrdenEstado.LISTO, orden.getEstado());
        assertEquals(MesaEstado.OCUPADA, mesa.getEstado());
        verify(ordenRepository, never()).save(any());
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
        mesa.setEstado(MesaEstado.POR_COBRAR);
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
        req.setRepartidorId(9L);

        ordenService.actualizarEstado(100L, req, 2L);

        assertEquals(OrdenEstado.ENTREGADO, orden.getEstado());
        assertNull(orden.getRepartidorId(), "SALON no lleva repartidor");
    }

    @Test
    void testFlujoCompletoDeliveryHastaEnPuertaYEntregado() {
        Orden orden = Orden.builder()
                .id(200L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.PENDIENTE_CONFIRMACION)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(200L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);

        // 1. Confirmar llamada -> PREPARANDO
        ActualizarEstadoRequest req1 = new ActualizarEstadoRequest();
        req1.setEstado(OrdenEstado.PREPARANDO);
        ordenService.actualizarEstado(200L, req1, 1L);
        assertEquals(OrdenEstado.PREPARANDO, orden.getEstado());

        // 2. Cocina lista -> LISTO_PARA_ENTREGAR
        ActualizarEstadoRequest req2 = new ActualizarEstadoRequest();
        req2.setEstado(OrdenEstado.LISTO_PARA_ENTREGAR);
        ordenService.actualizarEstado(200L, req2, 1L);
        assertEquals(OrdenEstado.LISTO_PARA_ENTREGAR, orden.getEstado());
        assertNotNull(orden.getListoAt());

        // 3. Despacho a ruta con repartidor -> EN_CAMINO
        ActualizarEstadoRequest req3 = new ActualizarEstadoRequest();
        req3.setEstado(OrdenEstado.EN_CAMINO);
        req3.setRepartidorId(5L);
        ordenService.actualizarEstado(200L, req3, 5L);
        assertEquals(OrdenEstado.EN_CAMINO, orden.getEstado());

        // 4. Repartidor llega a la puerta -> EN_PUERTA
        ActualizarEstadoRequest req4 = new ActualizarEstadoRequest();
        req4.setEstado(OrdenEstado.EN_PUERTA);
        ordenService.actualizarEstado(200L, req4, 5L);
        assertEquals(OrdenEstado.EN_PUERTA, orden.getEstado());
        assertNotNull(orden.getEnPuertaAt());

        // 5. Cobro y entrega -> ENTREGADO
        ActualizarEstadoRequest req5 = new ActualizarEstadoRequest();
        req5.setEstado(OrdenEstado.ENTREGADO);
        ordenService.actualizarEstado(200L, req5, 5L);
        assertEquals(OrdenEstado.ENTREGADO, orden.getEstado());
    }

    @Test
    void testTransicionAPedidoFantasmaDesdeEnPuertaEnDelivery() {
        Orden orden = Orden.builder()
                .id(201L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.EN_PUERTA)
                .repartidorId(5L)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(201L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.PEDIDO_FANTASMA);
        ordenService.actualizarEstado(201L, req, 5L);

        assertEquals(OrdenEstado.PEDIDO_FANTASMA, orden.getEstado());
        assertEquals("NO_ENTREGADO", orden.getMotivoFantasma());
    }

    @Test
    void testTransicionAPedidoFantasmaDesdeListoEnRecojo() {
        Orden orden = Orden.builder()
                .id(202L)
                .tipo(OrdenTipo.RECOJO)
                .estado(OrdenEstado.LISTO_PARA_ENTREGAR)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(202L)).thenReturn(Optional.of(orden));
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.PEDIDO_FANTASMA);
        ordenService.actualizarEstado(202L, req, 1L);

        assertEquals(OrdenEstado.PEDIDO_FANTASMA, orden.getEstado());
        assertEquals("ABANDONADO", orden.getMotivoFantasma());
    }

    @Test
    void testTransicionInvalidaDesdePendienteConfirmacionAEntregadoLanzaExcepcion() {
        Orden orden = Orden.builder()
                .id(203L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.PENDIENTE_CONFIRMACION)
                .items(new ArrayList<>())
                .build();
        when(ordenRepository.findById(203L)).thenReturn(Optional.of(orden));

        ActualizarEstadoRequest req = new ActualizarEstadoRequest();
        req.setEstado(OrdenEstado.ENTREGADO);

        assertThrows(IllegalArgumentException.class, () ->
                ordenService.actualizarEstado(203L, req, 1L));
    }

    // D1.5 — Identificación de rondas en comandas SALON
    @Test
    void testRondasEnComandaInicialYAgregadosSucesivosConMultiplesProductos() {
        Producto bebida = Producto.builder()
                .id(20L)
                .nombre("Inca Kola 1.5L")
                .precio(new BigDecimal("12.00"))
                .disponible(true)
                .build();

        CrearOrdenRequest crearReq = new CrearOrdenRequest();
        crearReq.setTipo(OrdenTipo.SALON);
        crearReq.setMesaId(1L);
        OrdenItemRequest init1 = new OrdenItemRequest();
        init1.setProductoId(10L);
        init1.setCantidad(1);
        OrdenItemRequest init2 = new OrdenItemRequest();
        init2.setProductoId(20L);
        init2.setCantidad(2);
        crearReq.setItems(List.of(init1, init2));

        when(mesaService.buscarOFallarConBloqueo(1L)).thenReturn(mesa);
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(1L), anyList())).thenReturn(List.of());
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(productoService.buscarConBloqueo(20L)).thenReturn(bebida);
        when(ordenRepository.save(any(Orden.class))).thenAnswer(inv -> {
            Orden o = inv.getArgument(0);
            if (o.getId() == null) o.setId(500L);
            long nextItemId = 1L;
            for (OrdenItem it : o.getItems()) {
                if (it.getId() == null) {
                    it.setId(nextItemId);
                }
                nextItemId = Math.max(nextItemId, it.getId()) + 1;
            }
            return o;
        });
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesa));

        // 1. Comanda inicial -> todos los ítems en ronda 1
        var creada = ordenService.crear(crearReq, 5L);
        assertEquals(2, creada.getItems().size());
        assertTrue(creada.getItems().stream().allMatch(i -> Integer.valueOf(1).equals(i.getRonda())),
                "todos los ítems de la comanda inicial deben tener ronda 1");

        ArgumentCaptor<Orden> ordenCaptor = ArgumentCaptor.forClass(Orden.class);
        verify(ordenRepository).save(ordenCaptor.capture());
        Orden ordenPersistida = ordenCaptor.getValue();
        when(ordenRepository.buscarConBloqueo(500L)).thenReturn(Optional.of(ordenPersistida));

        // 2. Segunda operación de agregado con dos productos -> ambos reciben ronda 2
        OrdenItemRequest r2Item1 = new OrdenItemRequest();
        r2Item1.setProductoId(10L); // mismo producto que en ronda 1
        r2Item1.setCantidad(1);
        OrdenItemRequest r2Item2 = new OrdenItemRequest();
        r2Item2.setProductoId(20L);
        r2Item2.setCantidad(1);

        var trasRonda2 = ordenService.agregarItems(500L, List.of(r2Item1, r2Item2), 5L);
        assertEquals(4, trasRonda2.getItems().size());
        assertEquals(1, trasRonda2.getItems().get(0).getRonda());
        assertEquals(1, trasRonda2.getItems().get(1).getRonda());
        assertEquals(2, trasRonda2.getItems().get(2).getRonda());
        assertEquals(2, trasRonda2.getItems().get(3).getRonda());
        assertNotEquals(trasRonda2.getItems().get(0).getId(), trasRonda2.getItems().get(2).getId(),
                "el mismo producto en rondas distintas conserva identificadores de ítem diferentes");

        // 3. Tercera operación de agregado -> recibe ronda 3
        OrdenItemRequest r3Item = new OrdenItemRequest();
        r3Item.setProductoId(10L);
        r3Item.setCantidad(3);

        var trasRonda3 = ordenService.agregarItems(500L, List.of(r3Item), 5L);
        assertEquals(5, trasRonda3.getItems().size());
        assertEquals(3, trasRonda3.getItems().get(4).getRonda());
    }

    @Test
    void testRegistrosAntiguosConRondaNullSeInterpretanComoRonda1() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        // comandaDeSalon crea el ítem inicial con ronda == null (simulando registro legado)
        Orden ordenLegada = comandaDeSalon(100L, mesaComanda, OrdenEstado.RECIBIDO, 1);
        assertNull(ordenLegada.getItems().get(0).getRonda(), "precondición: ítem legado tiene ronda null");

        // En OrdenResponse.from un registro con ronda null se expone como 1
        var respuestaInicial = com.sistema.polleria.orders.dto.OrdenResponse.from(ordenLegada);
        assertEquals(1, respuestaInicial.getItems().get(0).getRonda(),
                "un ítem con ronda NULL debe exponerse como ronda 1 en la respuesta");

        // Al agregar nuevos productos sobre una orden con ítems en NULL, la siguiente ronda es 2
        OrdenItemRequest nuevo = new OrdenItemRequest();
        nuevo.setProductoId(10L);
        nuevo.setCantidad(1);

        when(ordenRepository.buscarConBloqueo(100L)).thenReturn(Optional.of(ordenLegada));
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenReturn(ordenLegada);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        var respuestaAmpliada = ordenService.agregarItems(100L, List.of(nuevo), 2L);
        assertEquals(2, respuestaAmpliada.getItems().size());
        assertEquals(1, respuestaAmpliada.getItems().get(0).getRonda(),
                "el ítem antiguo sigue exponiéndose como ronda 1");
        assertEquals(2, respuestaAmpliada.getItems().get(1).getRonda(),
                "el nuevo agregado sobre ítems con ronda NULL debe recibir ronda 2");
    }

    // D1.8 — Quitar producto individual de comanda SALON (DELETE /ordenes/{id}/items/{itemId})
    @Test
    void testMozoPuedeEliminarItemEnRecibidoRecalculaTotalConservaRondasYReponeStock() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Producto prodConStock = Producto.builder()
                .id(15L)
                .nombre("1/4 Pollo")
                .precio(new BigDecimal("20.00"))
                .stock(0)
                .disponible(false)
                .build();

        Orden orden = Orden.builder()
                .id(600L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.RECIBIDO)
                .mesa(mesaComanda)
                .items(new ArrayList<>())
                .build();

        OrdenItem item1 = OrdenItem.builder()
                .id(1001L).orden(orden).producto(producto).cantidad(1)
                .precioUnitario(new BigDecimal("35.00")).subtotal(new BigDecimal("35.00"))
                .notas("bien cocido").ronda(1).build();
        OrdenItem item2 = OrdenItem.builder()
                .id(1002L).orden(orden).producto(prodConStock).cantidad(2)
                .precioUnitario(new BigDecimal("20.00")).subtotal(new BigDecimal("40.00"))
                .notas("sin ají").ronda(2).build();
        OrdenItem item3 = OrdenItem.builder()
                .id(1003L).orden(orden).producto(producto).cantidad(1)
                .precioUnitario(new BigDecimal("35.00")).subtotal(new BigDecimal("35.00"))
                .notas("para llevar").ronda(3).build();
        orden.getItems().addAll(List.of(item1, item2, item3));
        orden.recalcularTotal();

        when(ordenRepository.buscarConBloqueo(600L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(15L)).thenReturn(prodConStock);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        var resp = ordenService.eliminarItem(600L, 1002L, 10L, false);

        assertEquals(2, resp.getItems().size(), "deben quedar 2 ítems");
        assertEquals(new BigDecimal("70.00"), resp.getTotal(), "el total debe recalcularse a 35 + 35 = 70.00");
        assertEquals(1001L, resp.getItems().get(0).getId(), "el primer ítem conserva su ID");
        assertEquals(1, resp.getItems().get(0).getRonda(), "el primer ítem conserva su ronda 1");
        assertEquals("bien cocido", resp.getItems().get(0).getNotas());
        assertEquals(1003L, resp.getItems().get(1).getId(), "el tercer ítem conserva su ID");
        assertEquals(3, resp.getItems().get(1).getRonda(), "no se renumeran las rondas restantes (sigue siendo ronda 3)");
        assertEquals("para llevar", resp.getItems().get(1).getNotas());
        assertEquals(2, prodConStock.getStock(), "el stock se repone en RECIBIDO (+2)");
        assertTrue(prodConStock.isDisponible(), "el producto agotado por stock vuelve a estar disponible");
        assertNotNull(orden.getObservaciones());
        assertTrue(orden.getObservaciones().contains("1/4 Pollo"), "deja nota de auditoría en observaciones");
    }

    @Test
    void testMozoRecibe403AlEliminarItemEnEstadosDistintosDeRecibido() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        for (OrdenEstado estado : List.of(
                OrdenEstado.PREPARANDO,
                OrdenEstado.EN_PREPARACION,
                OrdenEstado.LISTO,
                OrdenEstado.LISTO_PARA_ENTREGAR,
                OrdenEstado.PENDIENTE_PAGO,
                OrdenEstado.PENDIENTE_CONFIRMACION)) {
            Orden orden = comandaDeSalon(601L, mesaComanda, estado, 1);
            OrdenItem extra = OrdenItem.builder()
                    .id(2002L).orden(orden).producto(producto).cantidad(1)
                    .precioUnitario(producto.getPrecio()).subtotal(producto.getPrecio()).ronda(2).build();
            orden.getItems().get(0).setId(2001L);
            orden.getItems().add(extra);
            when(ordenRepository.buscarConBloqueo(601L)).thenReturn(Optional.of(orden));

            assertThrows(org.springframework.security.access.AccessDeniedException.class, () ->
                    ordenService.eliminarItem(601L, 2002L, 10L, false),
                    "MOZO debe recibir AccessDeniedException (403) en estado " + estado);
            assertEquals(2, orden.getItems().size(), "no debe eliminarse ningún ítem en estado " + estado);
        }
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void testAdminEliminaItemEnEstadosActivosYReponeStockUnicamenteEnRecibido() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Producto prodConStock = Producto.builder()
                .id(16L).nombre("1/2 Pollo").precio(new BigDecimal("35.00")).stock(5).disponible(true).build();

        // 1. En cualquier estado activo distinto de RECIBIDO (EN_PREPARACION, PREPARANDO, LISTO,
        // LISTO_PARA_ENTREGAR, PENDIENTE_PAGO, PENDIENTE_CONFIRMACION), ADMIN puede eliminar el ítem
        // pero NO se repone stock.
        for (OrdenEstado estado : List.of(
                OrdenEstado.EN_PREPARACION,
                OrdenEstado.PREPARANDO,
                OrdenEstado.LISTO,
                OrdenEstado.LISTO_PARA_ENTREGAR,
                OrdenEstado.PENDIENTE_PAGO,
                OrdenEstado.PENDIENTE_CONFIRMACION)) {
            Orden orden = Orden.builder()
                    .id(602L).tipo(OrdenTipo.SALON).estado(estado).mesa(mesaComanda).items(new ArrayList<>()).build();
            OrdenItem i1 = OrdenItem.builder()
                    .id(3001L).orden(orden).producto(prodConStock).cantidad(1)
                    .precioUnitario(prodConStock.getPrecio()).subtotal(prodConStock.getPrecio()).ronda(1).build();
            OrdenItem i2 = OrdenItem.builder()
                    .id(3002L).orden(orden).producto(prodConStock).cantidad(1)
                    .precioUnitario(prodConStock.getPrecio()).subtotal(prodConStock.getPrecio()).ronda(2).build();
            orden.getItems().addAll(List.of(i1, i2));
            orden.recalcularTotal();

            when(ordenRepository.buscarConBloqueo(602L)).thenReturn(Optional.of(orden));
            when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
            when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

            var resp = ordenService.eliminarItem(602L, 3002L, 1L, true);

            assertEquals(1, resp.getItems().size(), "ADMIN puede quitar ítem en " + estado);
            assertEquals(new BigDecimal("35.00"), resp.getTotal());
            assertEquals(5, prodConStock.getStock(),
                    "en " + estado + " NO debe reponerse stock (Plan 1: solo se repone en RECIBIDO)");
        }
        verify(productoService, never()).buscarConBloqueo(16L);

        // 2. En cambio, cuando la orden está en RECIBIDO, ADMIN quita el ítem y SÍ se repone stock (5 -> 7).
        Orden ordenRecibido = Orden.builder()
                .id(609L).tipo(OrdenTipo.SALON).estado(OrdenEstado.RECIBIDO).mesa(mesaComanda).items(new ArrayList<>()).build();
        OrdenItem r1 = OrdenItem.builder()
                .id(3101L).orden(ordenRecibido).producto(prodConStock).cantidad(1)
                .precioUnitario(prodConStock.getPrecio()).subtotal(prodConStock.getPrecio()).ronda(1).build();
        OrdenItem r2 = OrdenItem.builder()
                .id(3102L).orden(ordenRecibido).producto(prodConStock).cantidad(2)
                .precioUnitario(prodConStock.getPrecio()).subtotal(new BigDecimal("70.00")).ronda(2).build();
        ordenRecibido.getItems().addAll(List.of(r1, r2));
        ordenRecibido.recalcularTotal();

        when(ordenRepository.buscarConBloqueo(609L)).thenReturn(Optional.of(ordenRecibido));
        when(productoService.buscarConBloqueo(16L)).thenReturn(prodConStock);
        when(ordenRepository.save(any(Orden.class))).thenReturn(ordenRecibido);

        var respRecibido = ordenService.eliminarItem(609L, 3102L, 1L, true);
        assertEquals(1, respRecibido.getItems().size());
        assertEquals(7, prodConStock.getStock(), "en RECIBIDO sí se repone el stock del ítem eliminado (+2)");
    }

    @Test
    void testValidacionesEliminarItemOrdenInexistenteItemAjenoNoSalonCerradaCanceladaYUltimoItem() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();

        // 1. Orden inexistente -> 404 NoSuchElementException
        when(ordenRepository.buscarConBloqueo(999L)).thenReturn(Optional.empty());
        assertThrows(java.util.NoSuchElementException.class, () ->
                ordenService.eliminarItem(999L, 1L, 1L, true));

        // 2. Orden de tipo diferente de SALON -> 400 IllegalArgumentException
        Orden delivery = Orden.builder().id(603L).tipo(OrdenTipo.DELIVERY).estado(OrdenEstado.RECIBIDO).items(new ArrayList<>()).build();
        when(ordenRepository.buscarConBloqueo(603L)).thenReturn(Optional.of(delivery));
        assertThrows(IllegalArgumentException.class, () ->
                ordenService.eliminarItem(603L, 1L, 1L, true));

        // 3. Orden cerrada (ENTREGADO) o cancelada (CANCELADO) -> 409 ConflictoDeEstadoException
        for (OrdenEstado terminal : List.of(OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO)) {
            Orden ordenTerminal = comandaDeSalon(604L, mesaComanda, terminal, 2);
            when(ordenRepository.buscarConBloqueo(604L)).thenReturn(Optional.of(ordenTerminal));
            assertThrows(ConflictoDeEstadoException.class, () ->
                    ordenService.eliminarItem(604L, 1L, 1L, true));
        }

        // 4. Ítem inexistente o perteneciente a otra orden -> 404 NoSuchElementException sin borrar nada
        Orden ordenConDos = comandaDeSalon(605L, mesaComanda, OrdenEstado.RECIBIDO, 1);
        ordenConDos.getItems().get(0).setId(4001L);
        OrdenItem seg = OrdenItem.builder()
                .id(4002L).orden(ordenConDos).producto(producto).cantidad(1)
                .precioUnitario(producto.getPrecio()).subtotal(producto.getPrecio()).ronda(1).build();
        ordenConDos.getItems().add(seg);
        when(ordenRepository.buscarConBloqueo(605L)).thenReturn(Optional.of(ordenConDos));

        assertThrows(java.util.NoSuchElementException.class, () ->
                ordenService.eliminarItem(605L, 9999L, 1L, false));
        assertEquals(2, ordenConDos.getItems().size(), "ningún ítem debe eliminarse cuando el itemId no pertenece a la orden");

        // 5. Intento de eliminar el último producto -> 409 ConflictoDeEstadoException
        Orden ordenUnicoItem = comandaDeSalon(606L, mesaComanda, OrdenEstado.RECIBIDO, 1);
        ordenUnicoItem.getItems().get(0).setId(5001L);
        when(ordenRepository.buscarConBloqueo(606L)).thenReturn(Optional.of(ordenUnicoItem));

        ConflictoDeEstadoException exUltimo = assertThrows(ConflictoDeEstadoException.class, () ->
                ordenService.eliminarItem(606L, 5001L, 1L, true));
        assertTrue(exUltimo.getMessage().toLowerCase().contains("sin productos"),
                "el mensaje debe indicar claramente que no se puede dejar una comanda sin productos: " + exUltimo.getMessage());
        assertEquals(1, ordenUnicoItem.getItems().size());
    }

    @Test
    void testNoSeReponeStockDosVecesAlEliminarItemYLuegoCancelarComanda() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Producto prodA = Producto.builder().id(17L).nombre("Pollo Entero").precio(new BigDecimal("65.00")).stock(10).disponible(true).build();
        Producto prodB = Producto.builder().id(18L).nombre("Chicha 1L").precio(new BigDecimal("15.00")).stock(10).disponible(true).build();

        Orden orden = Orden.builder()
                .id(607L).tipo(OrdenTipo.SALON).estado(OrdenEstado.RECIBIDO).mesa(mesaComanda).items(new ArrayList<>()).build();
        // Supongamos que ya se descontaron 2 de prodA (quedó en 8) y 1 de prodB (quedó en 9)
        prodA.setStock(8);
        prodB.setStock(9);

        OrdenItem itemA = OrdenItem.builder()
                .id(6001L).orden(orden).producto(prodA).cantidad(2)
                .precioUnitario(prodA.getPrecio()).subtotal(new BigDecimal("130.00")).ronda(1).build();
        OrdenItem itemB = OrdenItem.builder()
                .id(6002L).orden(orden).producto(prodB).cantidad(1)
                .precioUnitario(prodB.getPrecio()).subtotal(new BigDecimal("15.00")).ronda(1).build();
        orden.getItems().addAll(List.of(itemA, itemB));
        orden.recalcularTotal();

        when(ordenRepository.buscarConBloqueo(607L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(17L)).thenReturn(prodA);
        when(productoService.buscarConBloqueo(18L)).thenReturn(prodB);
        when(ordenRepository.save(any(Orden.class))).thenReturn(orden);
        when(mesaService.mapearMesaConOrdenActiva(any(Mesa.class))).thenReturn(MesaResponse.from(mesaComanda));

        // 1. Quitar itemA en RECIBIDO -> repone las 2 unidades de prodA (8 -> 10)
        ordenService.eliminarItem(607L, 6001L, 10L, false);
        assertEquals(10, prodA.getStock(), "prodA recupera sus 2 unidades al quitar el ítem");
        assertEquals(9, prodB.getStock(), "prodB sigue en 9");

        // 2. Cancelar la orden completa en RECIBIDO -> solo debe reponer itemB (9 -> 10), nunca itemA otra vez
        ActualizarEstadoRequest cancelar = new ActualizarEstadoRequest();
        cancelar.setEstado(OrdenEstado.CANCELADO);
        ordenService.actualizarEstado(607L, cancelar, 1L, false);

        assertEquals(10, prodA.getStock(), "prodA NO debe reponerse una segunda vez al cancelar la comanda");
        assertEquals(10, prodB.getStock(), "prodB recupera su unidad al cancelar la comanda");
    }

    @Test
    void testEliminarItemPropagaExcepcionParaRollbackTransaccionalSiFallaPersistencia() {
        Mesa mesaComanda = Mesa.builder().id(1L).numero(3).capacidad(4).estado(MesaEstado.OCUPADA).build();
        Orden orden = comandaDeSalon(608L, mesaComanda, OrdenEstado.RECIBIDO, 1);
        orden.getItems().get(0).setId(7001L);
        OrdenItem seg = OrdenItem.builder()
                .id(7002L).orden(orden).producto(producto).cantidad(1)
                .precioUnitario(producto.getPrecio()).subtotal(producto.getPrecio()).ronda(1).build();
        orden.getItems().add(seg);

        when(ordenRepository.buscarConBloqueo(608L)).thenReturn(Optional.of(orden));
        when(productoService.buscarConBloqueo(10L)).thenReturn(producto);
        when(ordenRepository.save(any(Orden.class))).thenThrow(new RuntimeException("Fallo simulado de BD"));

        assertThrows(RuntimeException.class, () ->
                ordenService.eliminarItem(608L, 7002L, 10L, false));
        verify(salonEventPublisher, never()).notificarNuevaComanda(any());
    }
}
