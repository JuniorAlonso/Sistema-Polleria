package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
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
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Edge cases of the Delivery / Recojo flow (odd/tasks/flow-edge-cases.md, T1): public checkout
 * state (S1), cancellation policy (S4), late call confirmation (S5), cash amount (S6), pickup
 * ticket (S7) and regression cases that were correct but untested (S14).
 */
@ExtendWith(MockitoExtension.class)
class OrdenFlujoBordesTest {

    @Mock private OrdenRepository ordenRepository;
    @Mock private ProductoService productoService;
    @Mock private MesaService mesaService;
    @Mock private NotificationService notificationService;
    @Mock private SalonEventPublisher salonEventPublisher;
    @Mock private NumeroPedidoService numeroPedidoService;
    @Mock private SancionDispatcherService sancionDispatcherService;

    @InjectMocks private OrdenService ordenService;

    // ---------------------------------------------------------------- S1 public checkout state

    @Test
    void checkoutPublicoNoPuedeAbrirUnPedidoEnRecibido() {
        CrearOrdenRequest r = crearRequest(OrdenTipo.DELIVERY, OrdenEstado.RECIBIDO);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(r, 0L, true));
        assertTrue(e.getMessage().contains("RECIBIDO"), e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void checkoutPublicoSinEstadoAbreDeliveryYRecojoEnPendientePago() {
        ArgumentCaptor<Orden> guardada = guardar();
        for (OrdenTipo tipo : List.of(OrdenTipo.DELIVERY, OrdenTipo.RECOJO)) {
            OrdenResponse resp = ordenService.crear(crearRequest(tipo, null), 0L, true);

            assertEquals(OrdenEstado.PENDIENTE_PAGO, guardada.getValue().getEstado(), tipo.name());
            assertEquals(OrdenEstado.PENDIENTE_PAGO, resp.getEstado(), tipo.name());
            assertFalse(resp.getRequiereCobroEfectivo());
        }
    }

    @Test
    void checkoutPublicoAceptaPendienteConfirmacion() {
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        ArgumentCaptor<Orden> guardada = guardar();

        ordenService.crear(crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION), 0L, true);

        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, guardada.getValue().getEstado());
    }

    @Test
    void personalSigueAbriendoEnRecibidoPorDefecto() {
        ArgumentCaptor<Orden> guardada = guardar();

        ordenService.crear(crearRequest(OrdenTipo.DELIVERY, null), 7L, false);
        assertEquals(OrdenEstado.RECIBIDO, guardada.getValue().getEstado());

        ordenService.crear(crearRequest(OrdenTipo.RECOJO, OrdenEstado.RECIBIDO), 7L, false);
        assertEquals(OrdenEstado.RECIBIDO, guardada.getValue().getEstado());
    }

    @Test
    void personalSigueAbriendoComandaDeSalonEnRecibido() {
        Mesa mesa = Mesa.builder().id(3L).numero(3).activo(true).estado(MesaEstado.LIBRE).build();
        when(mesaService.buscarOFallarConBloqueo(3L)).thenReturn(mesa);
        when(ordenRepository.findByMesaIdAndEstadoNotIn(eq(3L), any())).thenReturn(List.of());
        ArgumentCaptor<Orden> guardada = guardar();
        CrearOrdenRequest r = crearRequest(OrdenTipo.SALON, null);
        r.setMesaId(3L);

        ordenService.crear(r, 7L, false);

        assertEquals(OrdenEstado.RECIBIDO, guardada.getValue().getEstado());
    }

    @Test
    void elPagoAprobadoPorPaymentsSigueSacandoPendientePagoAPreparacion() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);
        cargar(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PREPARACION), 0L, true);

        assertEquals(OrdenEstado.EN_PREPARACION, o.getEstado());
    }

    // ---------------------------------------------------------------- S4 cancellation policy

    @Test
    void nadiePuedeCancelarUnPedidoEnCaminoOEnPuerta() {
        for (OrdenEstado estado : List.of(OrdenEstado.EN_CAMINO, OrdenEstado.EN_PUERTA)) {
            Orden o = orden(OrdenTipo.DELIVERY, estado);
            cargar(o);

            assertThrows(IllegalArgumentException.class,
                    () -> ordenService.actualizarEstado(1L, req(OrdenEstado.CANCELADO), 7L, false),
                    "staff from " + estado);
            assertThrows(IllegalArgumentException.class,
                    () -> ordenService.actualizarEstado(1L, req(OrdenEstado.CANCELADO), 0L, true),
                    "internal from " + estado);
            assertThrows(IllegalArgumentException.class,
                    () -> ordenService.cancelarComoCliente(1L, 5L),
                    "client from " + estado);
            assertEquals(estado, o.getEstado());
        }
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void elClienteSoloCancelaAntesDePreparacion() {
        for (OrdenEstado estado : List.of(OrdenEstado.EN_PREPARACION, OrdenEstado.PREPARANDO,
                OrdenEstado.LISTO, OrdenEstado.LISTO_PARA_ENTREGAR)) {
            Orden o = orden(OrdenTipo.RECOJO, estado);
            cargar(o);

            assertThrows(ConflictoDeEstadoException.class, () -> ordenService.cancelarComoCliente(1L, 5L),
                    "client from " + estado);
            assertEquals(estado, o.getEstado());
        }
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void elClienteCancelaDesdeRecibidoYPendientes() {
        for (OrdenEstado estado : List.of(OrdenEstado.RECIBIDO, OrdenEstado.PENDIENTE_PAGO,
                OrdenEstado.PENDIENTE_CONFIRMACION)) {
            Orden o = orden(OrdenTipo.DELIVERY, estado);
            cargar(o);

            ordenService.cancelarComoCliente(1L, 5L);

            assertEquals(OrdenEstado.CANCELADO, o.getEstado(), "client from " + estado);
        }
    }

    @Test
    void elPersonalYElSchedulerSiguenCancelandoPedidosEnPreparacionYPendientes() {
        Orden enCocina = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PREPARACION);
        cargar(enCocina);
        ordenService.actualizarEstado(1L, req(OrdenEstado.CANCELADO), 7L, false);
        assertEquals(OrdenEstado.CANCELADO, enCocina.getEstado());

        Orden pendiente = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);
        cargar(pendiente);
        ordenService.actualizarEstado(1L, req(OrdenEstado.CANCELADO), 0L);
        assertEquals(OrdenEstado.CANCELADO, pendiente.getEstado());
    }

    // ---------------------------------------------------------------- S5 late call confirmation

    @Test
    void confirmarLaLlamadaDespuesDe15MinutosCancelaElPedido() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        o.setRequiereCobroEfectivo(true);
        o.setCreadoEn(LocalDateTime.now().minusMinutes(16));
        cargar(o);

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.confirmarLlamada(1L, 3L));

        assertEquals("El plazo de 15 minutos para confirmar la llamada venció", ex.getMessage());
        assertEquals(OrdenEstado.CANCELADO, o.getEstado());
        assertNull(o.getLlamadaConfirmacionAt());
    }

    @Test
    void confirmarLaLlamadaDentroDelPlazoPasaAPreparando() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        o.setCreadoEn(LocalDateTime.now().minusMinutes(14));
        cargar(o);

        ordenService.confirmarLlamada(1L, 3L);

        assertEquals(OrdenEstado.PREPARANDO, o.getEstado());
    }

    // ---------------------------------------------------------------- S6 cash amount

    @Test
    void contraPagoConMontoMenorAlTotalSeRechaza() {
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        // 22.00 + delivery fee
        Producto p = Producto.builder().id(10L).nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00")).disponible(true).build();
        when(productoService.buscarOFallar(10L)).thenReturn(p);
        CrearOrdenRequest r = crearRequest(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        r.setMontoPagaCon(new BigDecimal("20"));

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(r, 0L, true));

        Orden referencia = Orden.builder().tipo(OrdenTipo.DELIVERY).items(new ArrayList<>()).build();
        referencia.getItems().add(OrdenItem.builder().subtotal(new BigDecimal("22.00")).build());
        referencia.recalcularTotal();
        assertEquals("El monto con el que pagas (S/ 20.00) no cubre el total del pedido (S/ "
                + referencia.getTotal().setScale(2) + ")", e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void contraPagoSinMontoOConMontoSuficienteSeAcepta() {
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        ArgumentCaptor<Orden> guardada = guardar();

        CrearOrdenRequest exacto = crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        ordenService.crear(exacto, 0L, true);
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, guardada.getValue().getEstado());

        CrearOrdenRequest conVuelto = crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        conVuelto.setMontoPagaCon(new BigDecimal("50"));
        ordenService.crear(conVuelto, 0L, true);
        assertEquals(0, new BigDecimal("28.00").compareTo(guardada.getValue().getVueltoEstimado()));
    }

    // ---------------------------------------------------------------- S7 pickup ticket

    @Test
    void entregarUnRecojoSinTicketSeRechaza() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO);
        cargar(o);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.ENTREGADO), 7L, false));
        assertTrue(e.getMessage().contains("ticket"), e.getMessage());
        assertEquals(OrdenEstado.LISTO, o.getEstado());
    }

    @Test
    void entregarUnRecojoConTicketIncorrectoSeRechazaTambienParaLlamadasInternas() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO);
        o.setNumeroCliente(12);
        cargar(o);

        for (String ticket : List.of("1", "12", "POL-2", "POL-12", "  ")) {
            ActualizarEstadoRequest r = req(OrdenEstado.ENTREGADO);
            r.setCodigoTicket(ticket);
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                    () -> ordenService.actualizarEstado(1L, r, 0L, true), "ticket '" + ticket + "'");
            assertTrue(e.getMessage().contains("ticket"), e.getMessage());
        }
        assertEquals(OrdenEstado.LISTO, o.getEstado());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void entregarUnRecojoConElTicketCorrectoIgnoraMayusculasEspaciosYGuiones() {
        for (String ticket : List.of("POL-1", "pol 1", "Pol1", " p-o-l - 1 ")) {
            Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO);
            cargar(o);
            ActualizarEstadoRequest r = req(OrdenEstado.ENTREGADO);
            r.setCodigoTicket(ticket);

            ordenService.actualizarEstado(1L, r, 7L, false);

            assertEquals(OrdenEstado.ENTREGADO, o.getEstado(), "ticket '" + ticket + "'");
        }
    }

    @Test
    void entregarUnDeliverySigueSinPedirTicket() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        cargar(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.ENTREGADO), 7L, false);

        assertEquals(OrdenEstado.ENTREGADO, o.getEstado());
    }

    // ---------------------------------------------------------------- S14 regression cases

    @Test
    void a1CrearSinProductosLoRechazaLaValidacionDelRequest() {
        CrearOrdenRequest r = crearRequest(OrdenTipo.DELIVERY, null);
        r.setItems(List.of());

        try (var factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            Set<ConstraintViolation<CrearOrdenRequest>> violaciones = validator.validate(r);
            assertTrue(violaciones.stream().anyMatch(v -> v.getPropertyPath().toString().equals("items")),
                    "empty items must be rejected: " + violaciones);
        }
    }

    @Test
    void a1CrearConProductoAgotadoSeRechaza() {
        Producto agotado = Producto.builder().id(10L).nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00")).disponible(false).build();
        when(productoService.buscarOFallar(10L)).thenReturn(agotado);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(crearRequest(OrdenTipo.DELIVERY, null), 0L, true));
        assertTrue(e.getMessage().contains("agotado"), e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void a1CrearConProductoInexistenteSeRechaza() {
        when(productoService.buscarOFallar(10L)).thenThrow(new NoSuchElementException("Producto no encontrado: 10"));

        assertThrows(NoSuchElementException.class,
                () -> ordenService.crear(crearRequest(OrdenTipo.DELIVERY, null), 0L, true));
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void a2DeliverySinDireccionSeRechaza() {
        CrearOrdenRequest r = crearRequest(OrdenTipo.DELIVERY, null);
        r.setDireccionEntrega("   ");

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(r, 0L, true));
        assertTrue(e.getMessage().contains("dirección"), e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void a3ContraPagoConSancionActivaResponde409() {
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(true);

        ConflictoDeEstadoException e = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.crear(crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION), 0L, true));
        assertTrue(e.getMessage().contains("sanción"), e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void d2DosIntentosDeLlamadaFallidosCancelanElPedido() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        cargar(o);

        ordenService.registrarIntentoLlamada(1L, 3L, "no contesta");
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado());
        assertEquals(1, o.getIntentosLlamada());

        ordenService.registrarIntentoLlamada(1L, 3L, "apagado");
        assertEquals(OrdenEstado.CANCELADO, o.getEstado());
        assertEquals(2, o.getIntentosLlamada());
    }

    @Test
    void d5ConfirmarLlamadaDeUnPedidoQueNoEsContraPagoResponde409() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);
        cargar(o);

        assertThrows(ConflictoDeEstadoException.class, () -> ordenService.confirmarLlamada(1L, 3L));
        assertEquals(OrdenEstado.PENDIENTE_PAGO, o.getEstado());
        assertNull(o.getLlamadaConfirmacionAt());
    }

    @Test
    void e2ListoParaEntregarRegistraListoAt() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PREPARANDO);
        cargar(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.LISTO_PARA_ENTREGAR), 7L, false);

        assertEquals(OrdenEstado.LISTO_PARA_ENTREGAR, o.getEstado());
        assertNotNull(o.getListoAt());
    }

    @Test
    void f3EnPuertaAntesDeEnCaminoSeRechaza() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.LISTO);
        cargar(o);

        assertThrows(IllegalArgumentException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PUERTA), 7L, false));
        assertEquals(OrdenEstado.LISTO, o.getEstado());
        assertNull(o.getEnPuertaAt());
    }

    // ---------------------------------------------------------------- helpers

    private Orden orden(OrdenTipo tipo, OrdenEstado estado) {
        return Orden.builder().id(1L).tipo(tipo).estado(estado).items(new ArrayList<>()).build();
    }

    private ActualizarEstadoRequest req(OrdenEstado estado) {
        ActualizarEstadoRequest r = new ActualizarEstadoRequest();
        r.setEstado(estado);
        return r;
    }

    private void cargar(Orden o) {
        lenient().when(ordenRepository.findById(1L)).thenReturn(Optional.of(o));
        lenient().when(ordenRepository.buscarConBloqueo(1L)).thenReturn(Optional.of(o));
        lenient().when(ordenRepository.save(any(Orden.class))).thenReturn(o);
    }

    private ArgumentCaptor<Orden> guardar() {
        Producto p = Producto.builder().id(10L).nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00")).disponible(true).build();
        lenient().when(productoService.buscarOFallar(10L)).thenReturn(p);
        ArgumentCaptor<Orden> captor = ArgumentCaptor.forClass(Orden.class);
        lenient().when(ordenRepository.save(captor.capture())).thenAnswer(i -> {
            Orden o = i.getArgument(0);
            o.setId(1L);
            return o;
        });
        return captor;
    }

    private CrearOrdenRequest crearRequest(OrdenTipo tipo, OrdenEstado inicial) {
        CrearOrdenRequest r = new CrearOrdenRequest();
        r.setTipo(tipo);
        r.setNombreCliente("Ana");
        r.setTelefonoCliente("987654321");
        r.setDireccionEntrega(tipo == OrdenTipo.DELIVERY ? "Av. Prueba 123" : null);
        r.setEstadoInicial(inicial);
        OrdenItemRequest item = new OrdenItemRequest();
        item.setProductoId(10L);
        item.setCantidad(1);
        r.setItems(List.of(item));
        return r;
    }
}
