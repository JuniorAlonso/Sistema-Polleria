package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.MermaResponse;
import com.sistema.polleria.inventory.dto.RegistrarMermaRequest;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.entity.MotivoMerma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MermaServiceTest {

    @Mock
    private MermaRepository mermaRepository;

    @Mock
    private InsumoRepository insumoRepository;

    @InjectMocks
    private MermaService mermaService;

    @Test
    @DisplayName("Debe registrar una merma descontando del stock disponible y auditando el motivo")
    void registrar_mermaExitosa() {
        Insumo pollo = Insumo.builder()
                .id(1L)
                .nombre("Pollo a la Brasa (cocinado)")
                .unidadMedida("UND")
                .stockActual(new BigDecimal("15.00"))
                .build();

        when(insumoRepository.findById(1L)).thenReturn(Optional.of(pollo));
        when(mermaRepository.save(any(Merma.class))).thenAnswer(inv -> {
            Merma m = inv.getArgument(0);
            m.setId(101L);
            return m;
        });

        RegistrarMermaRequest req = RegistrarMermaRequest.builder()
                .insumoId(1L)
                .cantidad(new BigDecimal("2.00"))
                .motivo(MotivoMerma.ERROR_COCINA)
                .justificacion("Dos pollos sobrecocidos por falla en control térmico del horno")
                .build();

        MermaResponse res = mermaService.registrar(req, 9L);

        assertThat(res.getId()).isEqualTo(101L);
        assertThat(res.getMotivo()).isEqualTo(MotivoMerma.ERROR_COCINA);
        assertThat(res.getCantidad()).isEqualByComparingTo("2.00");
        // Verifica descuento (15 - 2 = 13)
        assertThat(pollo.getStockActual()).isEqualByComparingTo("13.00");
        verify(insumoRepository).save(pollo);
        verify(mermaRepository).save(any(Merma.class));
    }

    @Test
    @DisplayName("Debe listar todas las mermas registradas")
    void listarTodas_retornaHistorial() {
        Merma m = Merma.builder()
                .id(1L)
                .insumoNombre("Papas Canchan")
                .cantidad(new BigDecimal("3.00"))
                .motivo(MotivoMerma.VENCIMIENTO)
                .fecha(LocalDateTime.now())
                .build();

        when(mermaRepository.findAllByOrderByFechaDesc()).thenReturn(List.of(m));

        List<MermaResponse> res = mermaService.listarTodas();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getMotivo()).isEqualTo(MotivoMerma.VENCIMIENTO);
        verify(mermaRepository).findAllByOrderByFechaDesc();
    }
}
