package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.entity.*;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

/**
 * A ContraPago order whose call was confirmed, or a Yape/Mercado Pago order whose payment was
 * approved, must enter the kitchen QUEUE (RECIBIDO, "por preparar" in the KDS) so the kitchen
 * starts it. Before, it jumped straight to PREPARANDO/EN_PREPARACION and the kitchen only saw a
 * "Listo" button.
 */
@ExtendWith(MockitoExtension.class)
class OrdenColaCocinaTest {

    @Mock private OrdenRepository ordenRepository;
    @Mock private ProductoService productoService;
    @Mock private MesaService mesaService;
    @Mock private NotificationService notificationService;
    @Mock private SalonEventPublisher salonEventPublisher;
    @Mock private NumeroPedidoService numeroPedidoService;
    @Mock private SancionDispatcherService sancionDispatcherService;

    @InjectMocks private OrdenService ordenService;

    private Orden orden(OrdenTipo tipo, OrdenEstado estado) {
        Producto pollo = Producto.builder().id(10L).nombre("Pollo").precio(new BigDecimal("20.00"))
                .disponible(true).stock(5).build();
        Orden o = Orden.builder().id(1L).tipo(tipo).estado(estado).creadoEn(LocalDateTime.now())
                .items(new ArrayList<>()).build();
        o.getItems().add(OrdenItem.builder().orden(o).producto(pollo).cantidad(2)
                .precioUnitario(pollo.getPrecio()).subtotal(new BigDecimal("40.00")).build());
        lenient().when(ordenRepository.findById(1L)).thenReturn(Optional.of(o));
        lenient().when(ordenRepository.buscarConBloqueo(1L)).thenReturn(Optional.of(o));
        lenient().when(productoService.buscarConBloqueo(10L)).thenReturn(pollo);
        return o;
    }

    private ActualizarEstadoRequest req(OrdenEstado estado) {
        ActualizarEstadoRequest r = new ActualizarEstadoRequest();
        r.setEstado(estado);
        return r;
    }

    @Test
    void confirmarLaLlamadaDejaElPedidoEnLaColaDeCocinaParaDeliveryYRecojo() {
        for (OrdenTipo tipo : List.of(OrdenTipo.DELIVERY, OrdenTipo.RECOJO)) {
            Orden o = orden(tipo, OrdenEstado.PENDIENTE_CONFIRMACION);

            ordenService.confirmarLlamada(1L, 3L);

            assertEquals(OrdenEstado.RECIBIDO, o.getEstado(), tipo + ": la cocina debe iniciarlo");
            assertNotNull(o.getLlamadaConfirmacionAt());
        }
    }

    @Test
    void elPagoAprobadoDejaElPedidoEnLaColaDeCocina() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);

        // payments-service, with the internal key, after approving the Yape capture or the card.
        ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 0L, true);

        assertEquals(OrdenEstado.RECIBIDO, o.getEstado());
    }

    @Test
    void laCocinaIniciaElPedidoConfirmado() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);
        ordenService.confirmarLlamada(1L, 3L);

        ordenService.actualizarEstado(1L, req(OrdenEstado.EN_PREPARACION), 4L, false);

        assertEquals(OrdenEstado.EN_PREPARACION, o.getEstado());
    }

    @Test
    void elPersonalNoPuedeMeterALaColaUnPedidoImpago() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.PENDIENTE_PAGO);

        assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 7L, false));
        assertEquals(OrdenEstado.PENDIENTE_PAGO, o.getEstado());
    }

    @Test
    void elPersonalNoPuedeMeterALaColaUnContraPagoSinLlamada() {
        Orden o = orden(OrdenTipo.RECOJO, OrdenEstado.PENDIENTE_CONFIRMACION);

        ConflictoDeEstadoException ex = assertThrows(ConflictoDeEstadoException.class,
                () -> ordenService.actualizarEstado(1L, req(OrdenEstado.RECIBIDO), 7L, false));
        assertTrue(ex.getMessage().contains("/confirmar-llamada"));
        assertEquals(OrdenEstado.PENDIENTE_CONFIRMACION, o.getEstado());
    }

    @Test
    void elClienteNoPuedeCancelarUnPedidoYaConfirmadoOPagado() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.RECIBIDO);

        assertThrows(ConflictoDeEstadoException.class, () -> ordenService.cancelarComoCliente(1L, 0L));
        assertEquals(OrdenEstado.RECIBIDO, o.getEstado());
    }

    @Test
    void preservaElClientePuedeCancelarMientrasEsperaPagoOLlamada() {
        for (OrdenEstado estado : List.of(OrdenEstado.PENDIENTE_PAGO, OrdenEstado.PENDIENTE_CONFIRMACION)) {
            Orden o = orden(OrdenTipo.DELIVERY, estado);

            ordenService.cancelarComoCliente(1L, 0L);

            assertEquals(OrdenEstado.CANCELADO, o.getEstado(), estado.name());
        }
    }

    @Test
    void elPersonalQueCancelaUnPedidoEnColaDevuelveElStock() {
        Orden o = orden(OrdenTipo.DELIVERY, OrdenEstado.RECIBIDO);
        Producto pollo = o.getItems().get(0).getProducto();

        ordenService.actualizarEstado(1L, req(OrdenEstado.CANCELADO), 7L, false);

        assertEquals(7, pollo.getStock(), "nada se cocinó todavía: las unidades vuelven");
    }
}
