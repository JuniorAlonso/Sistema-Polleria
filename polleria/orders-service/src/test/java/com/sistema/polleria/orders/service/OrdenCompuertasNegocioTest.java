package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Compuertas de negocio del PATCH de estado (S2, S4, S6, S7) y plazo del pedido fantasma. */
@ExtendWith(MockitoExtension.class)
class OrdenCompuertasNegocioTest {

    @Mock private OrdenRepository ordenRepository;
    @Mock private ProductoService productoService;
    @Mock private MesaService mesaService;
    @Mock private NotificationService notificationService;
    @Mock private SalonEventPublisher salonEventPublisher;
    @Mock private NumeroPedidoService numeroPedidoService;
    @Mock private SancionDispatcherService sancionDispatcherService;

    @InjectMocks private OrdenService ordenService;

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
    }

    // (a) PENDIENTE_PAGO -> preparación
    @Test
    void patchPersonalNoPuedeSacarPendientePagoAPreparacion() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);
        cargar(o);

        assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.PREPARANDO), 7L, false));
        assertEquals(OrdenEstado.PENDIENTE_PAGO, o.getEstado());
        verify(ordenRepository, never()).save(any());
    }

    @Test
    void llamadaInternaSiPuedeSacarPendientePagoAPreparacion() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.PREPARANDO), 7L, true);

        assertEquals(OrdenEstado.PREPARANDO, o.getEstado());
    }

    // (b) PENDIENTE_CONFIRMACION -> preparación
    @Test
    void patchPersonalNoPuedeConfirmarSinLlamada() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        cargar(o);

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PREPARACION), 7L, false));
        assertTrue(ex.getMessage().contains("/confirmar-llamada"));
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado());
    }

    @Test
    void patchPersonalPasaSiLaLlamadaYaSeConfirmo() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        o.setLlamadaConfirmacionAt(LocalDateTime.now());
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.PREPARANDO), 7L, false);

        assertEquals(OrdenEstado.PREPARANDO, o.getEstado());
    }

    @Test
    void confirmarLlamadaSigueFuncionando() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_CONFIRMACION);
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.confirmarLlamada(1L, 3L);

        assertEquals(OrdenEstado.PREPARANDO, o.getEstado());
        assertNotNull(o.getLlamadaConfirmacionAt());
    }

    // (c) ENTREGADO con cobro en efectivo pendiente
    @Test
    void patchPersonalNoPuedeEntregarSinCobroEnEfectivo() {
        for (OrdenTipo tipo : List.of(OrdenTipo.DELIVERY, OrdenTipo.RECOJO)) {
            Orden o = orden(tipo, tipo == OrdenTipo.DELIVERY ? OrdenEstado.EN_PUERTA : OrdenEstado.LISTO);
            o.setRequiereCobroEfectivo(true);
            cargar(o);

            ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                    () -> ordenService.actualizarEstado(1L, req(OrdenEstado.ENTREGADO), 7L, false));
            assertTrue(ex.getMessage().contains("cobro-efectivo"));
            assertNotEquals(OrdenEstado.ENTREGADO, o.getEstado());
        }
    }

    @Test
    void llamadaInternaDeCobroEfectivoSiPuedeEntregar() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        o.setRequiereCobroEfectivo(true);
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.ENTREGADO), 0L, true);

        assertEquals(OrdenEstado.ENTREGADO, o.getEstado());
    }

    @Test
    void patchPersonalEntregaSiNoRequiereCobroEnEfectivo() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO);
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);
        ActualizarEstadoRequest entrega = req(OrdenEstado.ENTREGADO);
        entrega.setCodigoTicket("POL-1"); // S7: pickup orders are handed over against their ticket

        ordenService.actualizarEstado(1L, entrega, 7L, false);

        assertEquals(OrdenEstado.ENTREGADO, o.getEstado());
    }

    // (d) PEDIDO_FANTASMA por PATCH
    @Test
    void patchPersonalNoPuedeDeclararPedidoFantasma() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        o.setEnPuertaAt(LocalDateTime.now().minusHours(2));
        cargar(o);

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.PEDIDO_FANTASMA), 7L, false));
        assertTrue(ex.getMessage().contains("/pedido-fantasma"));
        assertEquals(OrdenEstado.EN_PUERTA, o.getEstado());
    }

    // Salón no se ve afectado
    @Test
    void salonNoSeVeAfectadoPorLasCompuertas() {
        Orden o = orden(OrdenTipo.SALON, OrdenEstado.RECIBIDO);
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PREPARACION), 7L, false);
        assertEquals(OrdenEstado.EN_PREPARACION, o.getEstado());
        ordenService.actualizarEstado(1L, req(OrdenEstado.LISTO), 7L, false);
        ordenService.actualizarEstado(1L, req(OrdenEstado.ENTREGADO), 7L, false);
        assertEquals(OrdenEstado.ENTREGADO, o.getEstado());
    }

    // Plazo del pedido fantasma
    @Test
    void deliveryFantasmaManualAntesDe30MinutosEsRechazado() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        o.setEnPuertaAt(LocalDateTime.now().minusMinutes(10));
        cargar(o);

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.declararPedidoFantasma(1L, null, 7L));
        assertTrue(ex.getMessage().contains("faltan"));
        assertEquals(OrdenEstado.EN_PUERTA, o.getEstado());
    }

    @Test
    void deliveryFantasmaManualFueraDeEnPuertaEsRechazado() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_CAMINO);
        cargar(o);

        assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.declararPedidoFantasma(1L, null, 7L));
    }

    @Test
    void deliveryFantasmaManualDespuesDe30MinutosEsAceptado() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        o.setEnPuertaAt(LocalDateTime.now().minusMinutes(31));
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.declararPedidoFantasma(1L, null, 7L);

        assertEquals(OrdenEstado.PEDIDO_FANTASMA, o.getEstado());
        assertEquals("NO_ENTREGADO", o.getMotivoFantasma());
    }

    @Test
    void recojoFantasmaManualAntesDe1HoraEsRechazado() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO_PARA_ENTREGAR);
        o.setListoAt(LocalDateTime.now().minusMinutes(59));
        cargar(o);

        assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.declararPedidoFantasma(1L, null, 7L));
        assertEquals(OrdenEstado.LISTO_PARA_ENTREGAR, o.getEstado());
    }

    @Test
    void recojoFantasmaManualDespuesDe1HoraEsAceptado() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.LISTO);
        o.setListoAt(LocalDateTime.now().minusMinutes(61));
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.declararPedidoFantasma(1L, null, 7L);

        assertEquals(OrdenEstado.PEDIDO_FANTASMA, o.getEstado());
        assertEquals("ABANDONADO", o.getMotivoFantasma());
    }

    @Test
    void schedulerConUsuarioCeroDeclaraFantasmaSinEsperaAdicional() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.EN_PUERTA);
        o.setEnPuertaAt(LocalDateTime.now().minusMinutes(1));
        cargar(o);
        when(ordenRepository.save(any(Orden.class))).thenReturn(o);

        ordenService.declararPedidoFantasma(1L, "NO_ENTREGADO", 0L);

        assertEquals(OrdenEstado.PEDIDO_FANTASMA, o.getEstado());
    }

    // requiereCobroEfectivo en crear
    @Test
    void crearContraPagoMarcaRequiereCobroEfectivo() {
        CrearOrdenRequest r = crearRequest(OrdenEstado.PENDIENTE_CONFIRMACION);
        when(sancionDispatcherService.tieneSancionActiva(any(), any(), any())).thenReturn(false);
        ArgumentCaptor<Orden> guardada = guardar();

        OrdenResponse resp = ordenService.crear(r, 5L);

        assertTrue(guardada.getValue().getRequiereCobroEfectivo());
        assertTrue(resp.getRequiereCobroEfectivo());
    }

    @Test
    void crearSinContraPagoNoRequiereCobroEfectivo() {
        CrearOrdenRequest r = crearRequest(null);
        ArgumentCaptor<Orden> guardada = guardar();

        OrdenResponse resp = ordenService.crear(r, 5L);

        assertFalse(guardada.getValue().getRequiereCobroEfectivo());
        assertFalse(resp.getRequiereCobroEfectivo());
    }

    // estadoInicial: POST /ordenes is public, so it can only open an order in a state that still
    // waits for payment or for the cashier (S2). Anything further would skip both.
    @Test
    void crearConEstadoInicialQueSaltaElPagoSeRechaza() {
        for (OrdenEstado estado : List.of(OrdenEstado.PREPARANDO, OrdenEstado.EN_PREPARACION,
                OrdenEstado.LISTO_PARA_ENTREGAR, OrdenEstado.EN_CAMINO, OrdenEstado.ENTREGADO)) {
            CrearOrdenRequest r = crearRequest(estado);

            IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                    () -> ordenService.crear(r, 5L), "estadoInicial " + estado + " must be rejected");
            assertTrue(e.getMessage().contains("estado inicial"), e.getMessage());
        }
        verify(ordenRepository, never()).save(any(Orden.class));
    }

    @Test
    void crearConPendientePagoQuedaEsperandoLaCapturaSinCobroEfectivo() {
        CrearOrdenRequest r = crearRequest(OrdenEstado.PENDIENTE_PAGO);
        ArgumentCaptor<Orden> guardada = guardar();

        OrdenResponse resp = ordenService.crear(r, 5L);

        assertEquals(OrdenEstado.PENDIENTE_PAGO, guardada.getValue().getEstado());
        assertEquals(OrdenEstado.PENDIENTE_PAGO, resp.getEstado());
        assertFalse(resp.getRequiereCobroEfectivo());
    }

    private ArgumentCaptor<Orden> guardar() {
        Producto p = Producto.builder().id(10L).nombre("1/4 Pollo")
                .precio(new BigDecimal("22.00")).disponible(true).build();
        when(productoService.buscarOFallar(10L)).thenReturn(p);
        ArgumentCaptor<Orden> captor = ArgumentCaptor.forClass(Orden.class);
        when(ordenRepository.save(captor.capture())).thenAnswer(i -> {
            Orden o = i.getArgument(0);
            o.setId(1L);
            return o;
        });
        return captor;
    }

    private CrearOrdenRequest crearRequest(OrdenEstado inicial) {
        CrearOrdenRequest r = new CrearOrdenRequest();
        r.setTipo(OrdenTipo.RECOJO);
        r.setNombreCliente("Ana");
        r.setTelefonoCliente("987654321");
        r.setEstadoInicial(inicial);
        OrdenItemRequest item = new OrdenItemRequest();
        item.setProductoId(10L);
        item.setCantidad(1);
        r.setItems(List.of(item));
        return r;
    }
}
