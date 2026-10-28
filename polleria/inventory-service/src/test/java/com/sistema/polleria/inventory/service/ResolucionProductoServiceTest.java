package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaRequest;
import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaResponse;
import com.sistema.polleria.inventory.entity.DestinoProductoFantasma;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import com.sistema.polleria.inventory.entity.ResolucionProductoFantasma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import com.sistema.polleria.inventory.repository.ResolucionProductoFantasmaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResolucionProductoServiceTest {

    @Mock
    private MermaRepository mermaRepository;

    @Mock
    private InsumoRepository insumoRepository;

    @Mock
    private ResolucionProductoFantasmaRepository resolucionRepository;

    @Mock
    private OrdenesClient ordenesClient;

    @InjectMocks
    private ResolucionProductoService resolucionService;

    @Test
    void segundaResolucionDeLaMismaOrdenEsConflictoYNoRegistraNada() {
        when(resolucionRepository.findByOrdenId(500L)).thenReturn(Optional.of(ResolucionProductoFantasma.builder()
                .id(1L).ordenId(500L).destino(DestinoProductoFantasma.MERMA_JUSTIFICADA).build()));

        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                500L, "DELIVERY", DestinoProductoFantasma.MERMA_JUSTIFICADA, "Otra vez");

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> resolucionService.resolver(req, 4L));
        assertTrue(e.getMessage().contains("ya fue resuelto"), e.getMessage());
        verify(mermaRepository, never()).save(any(Merma.class));
        verify(resolucionRepository, never()).saveAndFlush(any(ResolucionProductoFantasma.class));
    }

    @Test
    void resolverUnaOrdenQueNoEsPedidoFantasmaEsConflictoYNoRegistraNada() {
        when(ordenesClient.obtenerEstado(503L)).thenReturn("ENTREGADO");

        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                503L, "RECOJO", DestinoProductoFantasma.MERMA_JUSTIFICADA, null);

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> resolucionService.resolver(req, 4L));
        assertTrue(e.getMessage().contains("no es un pedido fantasma"), e.getMessage());
        verify(mermaRepository, never()).save(any(Merma.class));
        verify(resolucionRepository, never()).saveAndFlush(any(ResolucionProductoFantasma.class));
    }

    @Test
    void resolverFallaCerradoSiOrdersNoResponde() {
        when(ordenesClient.obtenerEstado(504L)).thenThrow(new OrdenesClient.OrdenesNoDisponibleException("down", null));

        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                504L, "RECOJO", DestinoProductoFantasma.VENTA_RAPIDA_SALON, null);

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> resolucionService.resolver(req, 4L));
        assertTrue(e.getMessage().contains("no es un pedido fantasma"), e.getMessage());
        verify(mermaRepository, never()).save(any(Merma.class));
        verify(resolucionRepository, never()).saveAndFlush(any(ResolucionProductoFantasma.class));
    }

    @Test
    void testResolverMermaJustificadaRegistraEnLibroDeMermas() {
        when(ordenesClient.obtenerEstado(500L)).thenReturn("PEDIDO_FANTASMA");
        when(insumoRepository.findById(1L)).thenReturn(Optional.of(
                Insumo.builder().id(1L).nombre("Pollo Fresco Eviscerado").build()));

        when(mermaRepository.save(any(Merma.class))).thenAnswer(inv -> {
            Merma m = inv.getArgument(0);
            m.setId(50L);
            return m;
        });

        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                500L, "DELIVERY", DestinoProductoFantasma.MERMA_JUSTIFICADA, "Cliente no salió tras 30 min");

        ResolucionProductoFantasmaResponse res = resolucionService.resolver(req, 4L);

        assertNotNull(res);
        assertEquals(DestinoProductoFantasma.MERMA_JUSTIFICADA, res.destino());
        assertEquals(50L, res.mermaId());
        verify(mermaRepository, times(1)).save(any(Merma.class));
        verify(resolucionRepository, times(1)).saveAndFlush(argThat(r -> r.getOrdenId().equals(500L)
                && r.getDestino() == DestinoProductoFantasma.MERMA_JUSTIFICADA && r.getMermaId().equals(50L)));
    }

    @Test
    void testResolverVentaRapidaEnRecojoEsAceptado() {
        when(ordenesClient.obtenerEstado(501L)).thenReturn("PEDIDO_FANTASMA");
        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                501L, "RECOJO", DestinoProductoFantasma.VENTA_RAPIDA_SALON, "Plato intacto en vitrina");

        ResolucionProductoFantasmaResponse res = resolucionService.resolver(req, 4L);

        assertNotNull(res);
        assertEquals(DestinoProductoFantasma.VENTA_RAPIDA_SALON, res.destino());
        assertNull(res.mermaId());
        verify(mermaRepository, never()).save(any(Merma.class));
        verify(resolucionRepository, times(1)).saveAndFlush(argThat(r -> r.getOrdenId().equals(501L)
                && r.getDestino() == DestinoProductoFantasma.VENTA_RAPIDA_SALON));
    }

    @Test
    void testResolverVentaRapidaEnDeliveryEsRechazadoPorInocuidadAlimentaria() {
        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                502L, "DELIVERY", DestinoProductoFantasma.VENTA_RAPIDA_SALON, "Intentó reasignar comida de moto");

        assertThrows(IllegalArgumentException.class, () ->
                resolucionService.resolver(req, 4L));
    }
}
