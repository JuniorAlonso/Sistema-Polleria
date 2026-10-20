package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.CodigoSeguimiento;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.exception.DemasiadasSolicitudesException;
import com.sistema.polleria.orders.repository.CodigoSeguimientoRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeguimientoServiceTest {

    @Mock
    private CodigoSeguimientoRepository codigoRepository;

    @Mock
    private OrdenRepository ordenRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private OrdenService ordenService;

    private SeguimientoService seguimientoService;

    @BeforeEach
    void setUp() {
        seguimientoService = new SeguimientoService(codigoRepository, ordenRepository, notificationService,
                ordenService, "secreto-de-prueba-con-al-menos-32-caracteres");
    }

    @Test
    void enviaCodigoPorWhatsappSiElCelularTienePedidos() {
        when(codigoRepository.findTopByTelefonoOrderByCreadoEnDesc("938924552")).thenReturn(Optional.empty());
        when(ordenRepository.existsByTelefonoClienteIn(anyCollection())).thenReturn(true);

        seguimientoService.solicitarCodigo("51 938 924 552");

        ArgumentCaptor<CodigoSeguimiento> guardado = ArgumentCaptor.forClass(CodigoSeguimiento.class);
        verify(codigoRepository).save(guardado.capture());
        assertTrue(guardado.getValue().getCodigo().matches("\\d{4}"));
        verify(notificationService).enviarCodigoSeguimiento("938924552", guardado.getValue().getCodigo());
    }

    @Test
    void noEnviaNadaSiElCelularNoTienePedidos() {
        when(codigoRepository.findTopByTelefonoOrderByCreadoEnDesc("938924552")).thenReturn(Optional.empty());
        when(ordenRepository.existsByTelefonoClienteIn(anyCollection())).thenReturn(false);

        seguimientoService.solicitarCodigo("938924552");

        verify(codigoRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void noPermitePedirOtroCodigoAntesDeUnMinuto() {
        CodigoSeguimiento reciente = CodigoSeguimiento.builder()
                .telefono("938924552").codigo("1111")
                .creadoEn(LocalDateTime.now().minusSeconds(20))
                .expiraEn(LocalDateTime.now().plusMinutes(4))
                .build();
        when(codigoRepository.findTopByTelefonoOrderByCreadoEnDesc("938924552")).thenReturn(Optional.of(reciente));

        assertThrows(DemasiadasSolicitudesException.class, () -> seguimientoService.solicitarCodigo("938924552"));
        verifyNoInteractions(notificationService);
    }

    @Test
    void rechazaCelularInvalido() {
        assertThrows(IllegalArgumentException.class, () -> seguimientoService.solicitarCodigo("12345"));
    }

    @Test
    void codigoIncorrectoSumaUnIntento() {
        CodigoSeguimiento codigo = vigente("4827");
        when(codigoRepository.findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc("938924552")).thenReturn(Optional.of(codigo));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> seguimientoService.verificarCodigo("938924552", "0000"));

        assertEquals(1, codigo.getIntentos());
        assertTrue(error.getMessage().contains("4 intentos"));
    }

    @Test
    void codigoCorrectoDaAccesoSoloALosPedidosDeEseCelular() {
        CodigoSeguimiento codigo = vigente("4827");
        when(codigoRepository.findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc("938924552")).thenReturn(Optional.of(codigo));

        String token = seguimientoService.verificarCodigo("938924552", "4827");
        assertTrue(codigo.isUsado());

        Orden orden = Orden.builder().id(5L).numeroCliente(2).tipo(OrdenTipo.DELIVERY)
                .telefonoCliente("938924552").items(new ArrayList<>()).build();
        when(ordenRepository.findTop20ByTelefonoClienteInOrderByCreadoEnDesc(
                List.of("938924552", "51938924552", "+51938924552", "+51 938924552"))).thenReturn(List.of(orden));

        var pedidos = seguimientoService.listarPedidos(token);
        assertEquals(1, pedidos.size());
        assertEquals(2, pedidos.get(0).getNumeroCliente());
    }

    @Test
    void accesoAlteradoEsRechazado() {
        assertThrows(IllegalArgumentException.class, () -> seguimientoService.listarPedidos("token.falso.123"));
    }


    /**
     * T1 — La cancelación del invitado delega en el servicio de órdenes con el estado CANCELADO y sin
     * usuario (es un acceso de seguimiento, no una sesión), y solo aplica al pedido de ese celular.
     * Antes no tenía prueba unitaria: la cubría solo la integración.
     */
    @Test
    void cancelarPedidoDelegaConEstadoCanceladoYRechazaElDeOtroCelular() {
        when(codigoRepository.findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc("938924552"))
                .thenReturn(Optional.of(vigente("4827")));
        String token = seguimientoService.verificarCodigo("938924552", "4827");

        Orden propia = Orden.builder().id(7L).tipo(OrdenTipo.DELIVERY)
                .telefonoCliente("51 938 924 552").items(new ArrayList<>()).build();
        when(ordenRepository.findById(7L)).thenReturn(Optional.of(propia));
        when(ordenService.actualizarEstado(eq(7L), any(), isNull())).thenReturn(OrdenResponse.from(propia));

        seguimientoService.cancelarPedido(7L, token);

        ArgumentCaptor<ActualizarEstadoRequest> capturado = ArgumentCaptor.forClass(ActualizarEstadoRequest.class);
        verify(ordenService).actualizarEstado(eq(7L), capturado.capture(), isNull());
        assertEquals(OrdenEstado.CANCELADO, capturado.getValue().getEstado(),
                "reutiliza el flujo del personal en vez de implementar su propia cancelación");

        Orden ajena = Orden.builder().id(8L).telefonoCliente("911222333").items(new ArrayList<>()).build();
        when(ordenRepository.findById(8L)).thenReturn(Optional.of(ajena));

        assertThrows(NoSuchElementException.class, () -> seguimientoService.cancelarPedido(8L, token),
                "el pedido de otro celular responde 404");
        verify(ordenService, never()).actualizarEstado(eq(8L), any(), any());
    }

    private CodigoSeguimiento vigente(String valor) {
        return CodigoSeguimiento.builder()
                .telefono("938924552").codigo(valor)
                .creadoEn(LocalDateTime.now())
                .expiraEn(LocalDateTime.now().plusMinutes(5))
                .build();
    }
}
