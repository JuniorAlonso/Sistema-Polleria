package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.CrearDespachoRequest;
import com.sistema.polleria.inventory.dto.DespachoResponse;
import com.sistema.polleria.inventory.dto.ItemDespachoRequest;
import com.sistema.polleria.inventory.entity.DespachoCocina;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.repository.DespachoCocinaRepository;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DespachoServiceTest {

    @Mock
    private DespachoCocinaRepository despachoRepository;

    @Mock
    private InsumoRepository insumoRepository;

    @InjectMocks
    private DespachoService despachoService;

    @Test
    @DisplayName("Debe registrar un despacho a cocina descontando el stock del insumo")
    void registrarDespacho_exitoso() {
        Insumo pollo = Insumo.builder()
                .id(1L)
                .nombre("Pollo Entero")
                .unidadMedida("UND")
                .stockActual(new BigDecimal("30.00"))
                .build();

        when(insumoRepository.findById(1L)).thenReturn(Optional.of(pollo));
        when(despachoRepository.save(any(DespachoCocina.class))).thenAnswer(inv -> {
            DespachoCocina d = inv.getArgument(0);
            d.setId(10L);
            return d;
        });

        CrearDespachoRequest req = CrearDespachoRequest.builder()
                .solicitanteNombre("Chef Mario")
                .items(List.of(
                        ItemDespachoRequest.builder()
                                .insumoId(1L)
                                .cantidad(new BigDecimal("10.00"))
                                .observaciones("Para horneado de almuerzo")
                                .build()
                ))
                .build();

        DespachoResponse res = despachoService.registrarDespacho(req, 4L);

        assertThat(res.getId()).isEqualTo(10L);
        assertThat(res.getSolicitanteNombre()).isEqualTo("Chef Mario");
        assertThat(res.getItems()).hasSize(1);
        assertThat(res.getItems().get(0).getCantidad()).isEqualByComparingTo("10.00");
        // Verifica que se haya descontado el stock (30 - 10 = 20)
        assertThat(pollo.getStockActual()).isEqualByComparingTo("20.00");
        verify(insumoRepository).save(pollo);
        verify(despachoRepository).save(any(DespachoCocina.class));
    }

    @Test
    @DisplayName("Debe fallar si el stock disponible en almacen es insuficiente para el despacho")
    void registrarDespacho_stockInsuficiente() {
        Insumo papas = Insumo.builder()
                .id(2L)
                .nombre("Papas Canchan")
                .unidadMedida("KG")
                .stockActual(new BigDecimal("5.00"))
                .build();

        when(insumoRepository.findById(2L)).thenReturn(Optional.of(papas));

        CrearDespachoRequest req = CrearDespachoRequest.builder()
                .items(List.of(
                        ItemDespachoRequest.builder()
                                .insumoId(2L)
                                .cantidad(new BigDecimal("20.00"))
                                .build()
                ))
                .build();

        assertThatThrownBy(() -> despachoService.registrarDespacho(req, 4L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Stock insuficiente para Papas Canchan");

        verify(despachoRepository, never()).save(any());
    }
}
