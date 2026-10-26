package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaRequest;
import com.sistema.polleria.inventory.dto.ResolucionProductoFantasmaResponse;
import com.sistema.polleria.inventory.entity.DestinoProductoFantasma;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResolucionProductoServiceTest {

    @Mock
    private MermaRepository mermaRepository;

    @Mock
    private InsumoRepository insumoRepository;

    @InjectMocks
    private ResolucionProductoService resolucionService;

    @Test
    void testResolverMermaJustificadaRegistraEnLibroDeMermas() {
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
        verify(mermaRepository).save(any(Merma.class));
    }

    @Test
    void testResolverVentaRapidaEnRecojoEsAceptado() {
        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                501L, "RECOJO", DestinoProductoFantasma.VENTA_RAPIDA_SALON, "Plato intacto en vitrina");

        ResolucionProductoFantasmaResponse res = resolucionService.resolver(req, 4L);

        assertNotNull(res);
        assertEquals(DestinoProductoFantasma.VENTA_RAPIDA_SALON, res.destino());
        assertNull(res.mermaId());
        verify(mermaRepository, never()).save(any(Merma.class));
    }

    @Test
    void testResolverVentaRapidaEnDeliveryEsRechazadoPorInocuidadAlimentaria() {
        ResolucionProductoFantasmaRequest req = new ResolucionProductoFantasmaRequest(
                502L, "DELIVERY", DestinoProductoFantasma.VENTA_RAPIDA_SALON, "Intentó reasignar comida de moto");

        assertThrows(IllegalArgumentException.class, () ->
                resolucionService.resolver(req, 4L));
    }
}
