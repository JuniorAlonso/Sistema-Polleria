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
    void checkoutPublicoNoPuedeAbrirComandaDeSalon() {
        CrearOrdenRequest r = crearRequest(OrdenTipo.SALON, null);
        r.setMesaId(1L);

        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> ordenService.crear(r, 0L, true));
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
    void elClienteCancelaMientrasEsperaPagoOLlamada() {
        // Not RECIBIDO: there the order is already paid or confirmed and waits in the kitchen
        // queue (covered by OrdenColaCocinaTest).
        for (OrdenEstado estado : List.of(OrdenEstado.PENDIENTE_PAGO, OrdenEstado.PENDIENTE_CONFIRMACION)) {
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
    void confirmarLaLlamadaDentroDelPlazoPasaALaColaDeCocina() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        o.setCreadoEn(LocalDateTime.now().minusMinutes(14));
        cargar(o);

        ordenService.confirmarLlamada(1L, 3L);

        assertEquals(OrdenEstado.RECIBIDO, o.getEstado());
    }

    // ---------------------------------------------------------------- S6 cash amount

    @Test
    void contraPagoConMontoMenorAlTotalSeRechaza() {
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        // 22.00 + delivery fee
        Producto p = Producto.builder().id(10L).nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00")).disponible(true).build();
        when(productoService.buscarConBloqueo(10L)).thenReturn(p);
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
        when(productoService.buscarConBloqueo(10L)).thenReturn(agotado);

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(crearRequest(OrdenTipo.DELIVERY, null), 0L, true));
        assertTrue(e.getMessage().contains("agotado"), e.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void a1CrearConProductoInexistenteSeRechaza() {
        when(productoService.buscarConBloqueo(10L)).thenThrow(new NoSuchElementException("Producto no encontrado: 10"));

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
        java.time.Instant t0 = java.time.Instant.parse("2026-11-16T15:00:00Z");
        java.time.ZoneId zona = java.time.ZoneId.of("America/Lima");
        ordenService.setClock(java.time.Clock.fixed(t0, zona));

        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        cargar(o);

        ordenService.registrarIntentoLlamada(1L, 3L, "no contesta");
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado());
        assertEquals(1, o.getIntentosLlamada());
        assertNotNull(o.getActualizadoEn());

        ordenService.setClock(java.time.Clock.fixed(t0.plus(java.time.Duration.ofMinutes(5)), zona));
        ordenService.registrarIntentoLlamada(1L, 3L, "apagado");
        assertEquals(OrdenEstado.CANCELADO, o.getEstado());
        assertEquals(2, o.getIntentosLlamada());
    }

    @Test
    void d29SegundoIntentoAntesDeCincoMinutosResponde409YNoIncrementaContador() {
        java.time.Instant t0 = java.time.Instant.parse("2026-11-16T15:00:00Z");
        java.time.ZoneId zona = java.time.ZoneId.of("America/Lima");
        ordenService.setClock(java.time.Clock.fixed(t0, zona));

        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        cargar(o);

        ordenService.registrarIntentoLlamada(1L, 3L, "timbra y no contesta");
        assertEquals(1, o.getIntentosLlamada());
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado());

        // A los 4 minutos: aún no se cumplen los 5 minutos mínimos
        ordenService.setClock(java.time.Clock.fixed(t0.plus(java.time.Duration.ofMinutes(4)), zona));
        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.registrarIntentoLlamada(1L, 3L, "segundo intento prematuro"));
        assertTrue(ex.getMessage().contains("5 minutos"), ex.getMessage());
        assertEquals(1, o.getIntentosLlamada(), "el rechazo por tiempo no debe incrementar intentosLlamada");
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado(), "el pedido sigue pendiente de confirmación");
    }

    @Test
    void d29SegundoIntentoDespuesDeCincoMinutosCancelaYReponeStock() {
        java.time.Instant t0 = java.time.Instant.parse("2026-11-16T15:00:00Z");
        java.time.ZoneId zona = java.time.ZoneId.of("America/Lima");
        ordenService.setClock(java.time.Clock.fixed(t0, zona));

        Producto pollo = Producto.builder()
                .id(10L).nombre("Pollo Entero").precio(new BigDecimal("65.00"))
                .stock(0).disponible(false).build();
        when(productoService.buscarConBloqueo(10L)).thenReturn(pollo);

        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        o.getItems().add(OrdenItem.builder()
                .id(100L).orden(o).producto(pollo).cantidad(2)
                .precioUnitario(pollo.getPrecio()).subtotal(new BigDecimal("130.00")).ronda(1).build());
        cargar(o);

        // Primer intento
        ordenService.registrarIntentoLlamada(1L, 3L, "primer intento");
        assertEquals(1, o.getIntentosLlamada());
        assertEquals(0, pollo.getStock());

        // Segundo intento a los 6 minutos (> 5 min): cancela y repone las 2 unidades al stock
        ordenService.setClock(java.time.Clock.fixed(t0.plus(java.time.Duration.ofMinutes(6)), zona));
        ordenService.registrarIntentoLlamada(1L, 3L, "segundo intento sin respuesta");

        assertEquals(OrdenEstado.CANCELADO, o.getEstado());
        assertEquals(2, o.getIntentosLlamada());
        assertEquals(2, pollo.getStock(), "el stock descontado debe reponerse al cancelar en el 2.° intento");
        assertTrue(pollo.isDisponible(), "el plato agotado por stock 0 se reactiva al devolver unidades");
    }

    @Test
    void r21PendienteConfirmacionExigeTelefonoValidoYNoVacio() {
        // 1) Teléfono ausente (null)
        CrearOrdenRequest sinTelefono = crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        sinTelefono.setTelefonoCliente(null);
        IllegalArgumentException exNull = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(sinTelefono, 0L, true));
        assertTrue(exNull.getMessage().toLowerCase().contains("teléfono"), exNull.getMessage());

        // 2) Teléfono vacío o solo espacios
        for (String vacio : List.of("", "   ")) {
            CrearOrdenRequest enBlanco = crearRequest(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
            enBlanco.setTelefonoCliente(vacio);
            IllegalArgumentException exVacio = assertThrows(IllegalArgumentException.class,
                    () -> ordenService.crear(enBlanco, 0L, true));
            assertTrue(exVacio.getMessage().toLowerCase().contains("teléfono"), exVacio.getMessage());
        }

        // 3) Teléfono con formato inválido
        CrearOrdenRequest invalido = crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        invalido.setTelefonoCliente("12345");
        IllegalArgumentException exInvalido = assertThrows(IllegalArgumentException.class,
                () -> ordenService.crear(invalido, 0L, true));
        assertTrue(exInvalido.getMessage().toLowerCase().contains("teléfono"), exInvalido.getMessage());
        verify(ordenRepository, never()).save(any(Orden.class));

        // 4) Teléfono válido es aceptado
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        ArgumentCaptor<Orden> guardada = guardar();
        CrearOrdenRequest valido = crearRequest(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        valido.setTelefonoCliente("+51 987 654 321");

        OrdenResponse resp = ordenService.crear(valido, 0L, true);

        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, resp.getEstado());
        assertEquals("+51 987 654 321", guardada.getValue().getTelefonoCliente());
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

    // ---------------------------------------------------------------- Fase A2.1 idempotencia de actualizarEstado

    @Test
    void a21PendientePagoARecibidoActualizaEstadoYNotificaUnaSolaVez() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_PAGO);
        cargar(o);

        var res = ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 0L, true);

        assertEquals(OrdenEstado.RECIBIDO, res.getEstado());
        assertEquals(OrdenEstado.RECIBIDO, o.getEstado());
        verify(ordenRepository, times(1)).save(o);
        verify(notificationService, times(1)).notificarCambioEstado(o, OrdenEstado.RECIBIDO);
    }

    @Test
    void a21RecibidoARecibidoEsIdempotenteSinRepetirNotificacionStockNiTimestamps() {
        Producto pollo = Producto.builder().id(10L).nombre("Pollo").precio(new BigDecimal("22.00"))
                .disponible(true).stock(15).build();
        LocalDateTime actualizadoInicial = LocalDateTime.of(2026, 11, 16, 12, 0, 0);
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.RECIBIDO);
        o.setActualizadoEn(actualizadoInicial);
        o.getItems().add(OrdenItem.builder().orden(o).producto(pollo).cantidad(2)
                .precioUnitario(pollo.getPrecio()).subtotal(new BigDecimal("44.00")).build());
        cargar(o);

        var res = ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 0L, true);

        assertEquals(OrdenEstado.RECIBIDO, res.getEstado());
        assertEquals(OrdenEstado.RECIBIDO, o.getEstado());
        assertEquals(15, pollo.getStock(), "el stock no debe alterarse");
        assertEquals(actualizadoInicial, o.getActualizadoEn(), "actualizadoEn no debe alterarse");
        assertNull(o.getListoAt());
        assertNull(o.getEnPuertaAt());
        verify(ordenRepository, never()).save(any(Orden.class));
        verify(notificationService, never()).notificarCambioEstado(any(), any());
        verify(productoService, never()).buscarConBloqueo(any());
        verifyNoInteractions(sancionDispatcherService);
    }

    @Test
    void a21RecibidoAEnPreparacionContinuaPermitiendoTransicionYEjecutaEfectosNormales() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.RECIBIDO);
        cargar(o);

        // Llamada idempotente previa RECIBIDO -> RECIBIDO
        ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 0L, true);
        verify(notificationService, never()).notificarCambioEstado(any(), any());

        // Transición real posterior RECIBIDO -> EN_PREPARACION
        var res = ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PREPARACION), 4L, false);

        assertEquals(OrdenEstado.EN_PREPARACION, res.getEstado());
        assertEquals(OrdenEstado.EN_PREPARACION, o.getEstado());
        verify(ordenRepository, times(1)).save(o);
        verify(notificationService, times(1)).notificarCambioEstado(o, OrdenEstado.EN_PREPARACION);
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
        lenient().when(productoService.buscarConBloqueo(10L)).thenReturn(p);
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
