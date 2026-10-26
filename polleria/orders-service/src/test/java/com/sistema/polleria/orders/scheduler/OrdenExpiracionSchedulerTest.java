package com.sistema.polleria.orders.scheduler;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.service.OrdenService;
import com.sistema.polleria.orders.service.SancionDispatcherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrdenExpiracionSchedulerTest {

    @Mock
    private OrdenRepository ordenRepository;

    @Mock
    private OrdenService ordenService;

    @Mock
    private SancionDispatcherService sancionDispatcherService;

    @InjectMocks
    private OrdenExpiracionScheduler scheduler;

    @Test
    void testCancelaOrdenesExpiradasEnPendienteConfirmacion() {
        Orden o = Orden.builder()
                .id(50L)
                .estado(OrdenEstado.PENDIENTE_CONFIRMACION)
                .creadoEn(LocalDateTime.now().minusMinutes(20))
                .build();
        when(ordenRepository.findExpiradosConfirmacion(any(LocalDateTime.class)))
                .thenReturn(List.of(o));
        when(ordenRepository.findExpiradosPago(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosEnPuerta(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosRecojo(any(LocalDateTime.class)))
                .thenReturn(List.of());

        scheduler.verificarExpiraciones();

        ArgumentCaptor<ActualizarEstadoRequest> captor = ArgumentCaptor.forClass(ActualizarEstadoRequest.class);
        verify(ordenService).actualizarEstado(eq(50L), captor.capture(), eq(0L));
        assertEquals(OrdenEstado.CANCELADO, captor.getValue().getEstado());
    }

    @Test
    void testMarcaPedidoFantasmaPorSuperar30MinEnPuerta() {
        Orden o = Orden.builder()
                .id(51L)
                .tipo(OrdenTipo.DELIVERY)
                .estado(OrdenEstado.EN_PUERTA)
                .enPuertaAt(LocalDateTime.now().minusMinutes(35))
                .build();
        when(ordenRepository.findExpiradosConfirmacion(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosPago(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosEnPuerta(any(LocalDateTime.class)))
                .thenReturn(List.of(o));
        when(ordenRepository.findExpiradosRecojo(any(LocalDateTime.class)))
                .thenReturn(List.of());

        scheduler.verificarExpiraciones();

        verify(ordenService).declararPedidoFantasma(eq(51L), eq("NO_ENTREGADO"), eq(0L));
    }

    @Test
    void testMarcaPedidoFantasmaPorSuperar1HoraEnRecojo() {
        Orden o = Orden.builder()
                .id(52L)
                .tipo(OrdenTipo.RECOJO)
                .estado(OrdenEstado.LISTO_PARA_ENTREGAR)
                .listoAt(LocalDateTime.now().minusMinutes(70))
                .build();
        when(ordenRepository.findExpiradosConfirmacion(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosPago(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosEnPuerta(any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(ordenRepository.findExpiradosRecojo(any(LocalDateTime.class)))
                .thenReturn(List.of(o));

        scheduler.verificarExpiraciones();

        verify(ordenService).declararPedidoFantasma(eq(52L), eq("ABANDONADO"), eq(0L));
    }
}
