package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.OrdenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NumeroPedidoServiceTest {

    @Mock
    private OrdenRepository ordenRepository;

    @InjectMocks
    private NumeroPedidoService numeroPedidoService;

    @Test
    void clienteConCuentaContinuaSuPropiaNumeracion() {
        Orden orden = Orden.builder().clienteId(8L).telefonoCliente("938924552").build();
        when(ordenRepository.maxNumeroPorCliente(8L)).thenReturn(2);

        numeroPedidoService.asignar(orden);

        assertEquals(3, orden.getNumeroCliente());
        verify(ordenRepository, never()).maxNumeroPorTelefono(anyCollection());
    }

    @Test
    void primerPedidoDeUnClienteEsElNumeroUno() {
        Orden orden = Orden.builder().clienteId(1334L).build();
        when(ordenRepository.maxNumeroPorCliente(1334L)).thenReturn(0);

        numeroPedidoService.asignar(orden);

        assertEquals(1, orden.getNumeroCliente());
    }

    @Test
    void invitadoSeNumeraPorCelularSinImportarElFormato() {
        Orden orden = Orden.builder().clienteId(0L).telefonoCliente("+51 938 924 552").build();
        when(ordenRepository.maxNumeroPorTelefono(List.of("938924552", "51938924552", "+51938924552", "+51 938924552")))
                .thenReturn(4);

        numeroPedidoService.asignar(orden);

        assertEquals(5, orden.getNumeroCliente());
    }

    @Test
    void noCambiaElNumeroDeUnaOrdenQueYaLoTiene() {
        Orden orden = Orden.builder().clienteId(8L).numeroCliente(7).build();

        numeroPedidoService.asignar(orden);

        assertEquals(7, orden.getNumeroCliente());
        verifyNoInteractions(ordenRepository);
    }
}
