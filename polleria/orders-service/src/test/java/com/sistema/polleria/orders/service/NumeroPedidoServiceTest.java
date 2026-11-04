package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.ContadorPedido;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.ContadorPedidoRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NumeroPedidoServiceTest {

    @Mock
    private OrdenRepository ordenRepository;

    @Mock
    private ContadorPedidoRepository contadorPedidoRepository;

    @InjectMocks
    private NumeroPedidoService numeroPedidoService;

    private void contadorEn(String clave, int ultimo) {
        when(contadorPedidoRepository.buscarConBloqueo(clave))
                .thenReturn(Optional.of(new ContadorPedido(clave, ultimo)));
    }

    @Test
    void clienteConCuentaContinuaSuPropiaNumeracion() {
        Orden orden = Orden.builder().clienteId(8L).telefonoCliente("938924552").build();
        when(ordenRepository.maxNumeroPorCliente(8L)).thenReturn(2);
        contadorEn("C:8", 0);

        numeroPedidoService.asignar(orden);

        assertEquals(3, orden.getNumeroCliente());
        verify(ordenRepository, never()).maxNumeroPorTelefono(anyCollection());
    }

    @Test
    void primerPedidoDeUnClienteEsElNumeroUno() {
        Orden orden = Orden.builder().clienteId(1334L).build();
        when(ordenRepository.maxNumeroPorCliente(1334L)).thenReturn(0);
        contadorEn("C:1334", 0);

        numeroPedidoService.asignar(orden);

        assertEquals(1, orden.getNumeroCliente());
    }

    @Test
    void invitadoSeNumeraPorCelularSinImportarElFormato() {
        Orden orden = Orden.builder().clienteId(0L).telefonoCliente("+51 938 924 552").build();
        when(ordenRepository.maxNumeroPorTelefono(List.of("938924552", "51938924552", "+51938924552", "+51 938924552")))
                .thenReturn(4);
        contadorEn("T:938924552", 0);

        numeroPedidoService.asignar(orden);

        assertEquals(5, orden.getNumeroCliente());
    }

    @Test
    void noCambiaElNumeroDeUnaOrdenQueYaLoTiene() {
        Orden orden = Orden.builder().clienteId(8L).numeroCliente(7).build();

        numeroPedidoService.asignar(orden);

        assertEquals(7, orden.getNumeroCliente());
        verifyNoInteractions(ordenRepository, contadorPedidoRepository);
    }

    /**
     * Núcleo del arreglo de concurrencia: el contador es la fuente de verdad, no el MAX de la
     * tabla de órdenes. Si dos mozos atienden al mismo cliente a la vez, el segundo no ve
     * todavía la orden del primero, así que MAX seguiría siendo 1 y ambos asignarían el 2.
     */
    @Test
    void elContadorMandaAunqueLaOrdenAnteriorTodaviaNoSeVeEnLaTabla() {
        Orden orden = Orden.builder().clienteId(8L).build();
        when(ordenRepository.maxNumeroPorCliente(8L)).thenReturn(1);
        contadorEn("C:8", 2);          // otro mozo ya consumió el 2

        numeroPedidoService.asignar(orden);

        assertEquals(3, orden.getNumeroCliente());
    }

    @Test
    void unaOrdenAntiguaSinContadorNoRepiteNumero() {        Orden orden = Orden.builder().clienteId(8L).build();
        when(ordenRepository.maxNumeroPorCliente(8L)).thenReturn(9);   // historial previo
        contadorEn("C:8", 0);                                          // contador recién creado

        numeroPedidoService.asignar(orden);

        assertEquals(10, orden.getNumeroCliente());
    }

    @Test
    void laFilaDelContadorSeCreaAntesDeBloquearla() {        Orden orden = Orden.builder().clienteId(8L).build();
        when(ordenRepository.maxNumeroPorCliente(8L)).thenReturn(0);
        contadorEn("C:8", 0);

        numeroPedidoService.asignar(orden);

        verify(contadorPedidoRepository).crearSiNoExiste("C:8");
        verify(contadorPedidoRepository).buscarConBloqueo("C:8");
        verify(contadorPedidoRepository).save(argThat(c -> "C:8".equals(c.getClave()) && c.getUltimo() == 1));
        verify(ordenRepository, never()).maxNumeroPorTelefono(anyCollection());
    }

    /**
     * Un celular escrito en un formato que TelefonoUtil no sabe normalizar no debe abrir una
     * secuencia propia: si lo hiciera, el mismo cliente vería "tu pedido N.° 1" dos veces.
     */
    @Test
    void unCelularEnFormatoRaroComparteSecuenciaConSuFormaNormalizada() {
        Orden orden = Orden.builder().clienteId(0L).telefonoCliente("(01) 987654321").build();
        contadorEn("T:987654321", 4);

        numeroPedidoService.asignar(orden);

        assertEquals(5, orden.getNumeroCliente());
        verify(contadorPedidoRepository).crearSiNoExiste("T:987654321");
        verify(contadorPedidoRepository).buscarConBloqueo("T:987654321");
    }
}
