package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.AlertaStockResponse;
import com.sistema.polleria.inventory.dto.RentabilidadInventarioResponse;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventarioAnalisisServiceTest {

    @Mock
    private InsumoRepository insumoRepository;

    @Mock
    private MermaRepository mermaRepository;

    @InjectMocks
    private InventarioAnalisisService analisisService;

    @Test
    @DisplayName("Debe clasificar criticidad ALTO o CRITICO segun si el stock es cero o menor al minimo")
    void obtenerAlertasStock_clasificaNivelCorrecto() {
        Insumo bajo = Insumo.builder()
                .id(1L)
                .nombre("Carbón Vegetal")
                .stockActual(new BigDecimal("5.00"))
                .stockMinimoAlerta(new BigDecimal("10.00"))
                .unidadMedida("BOLSA")
                .build();

        Insumo agotado = Insumo.builder()
                .id(2L)
                .nombre("Aceite Vegetal")
                .stockActual(BigDecimal.ZERO)
                .stockMinimoAlerta(new BigDecimal("15.00"))
                .unidadMedida("L")
                .build();

        when(insumoRepository.findCriticos()).thenReturn(List.of(bajo, agotado));

        List<AlertaStockResponse> alertas = analisisService.obtenerAlertasStock();

        assertThat(alertas).hasSize(2);
        assertThat(alertas.get(0).getNivelCriticidad()).isEqualTo("ALTO");
        assertThat(alertas.get(1).getNivelCriticidad()).isEqualTo("CRITICO");
    }

    @Test
    @DisplayName("Debe calcular la valorizacion total del inventario y el costo acumulado de mermas")
    void obtenerBalanceRentabilidad_calculaTotalesCorrectamente() {
        Insumo pollo = Insumo.builder()
                .id(1L)
                .nombre("Pollo Crudo")
                .stockActual(new BigDecimal("20.00"))
                .stockMinimoAlerta(new BigDecimal("5.00"))
                .costoUnitario(new BigDecimal("15.00")) // Valor = 300.00
                .unidadMedida("UND")
                .build();

        Insumo papas = Insumo.builder()
                .id(2L)
                .nombre("Papas")
                .stockActual(new BigDecimal("50.00"))
                .stockMinimoAlerta(new BigDecimal("10.00"))
                .costoUnitario(new BigDecimal("2.00")) // Valor = 100.00
                .unidadMedida("KG")
                .build();

        Merma mermaPollo = Merma.builder()
                .insumoId(1L)
                .cantidad(new BigDecimal("2.00")) // Costo merma = 2 * 15.00 = 30.00
                .build();

        when(insumoRepository.findAll()).thenReturn(List.of(pollo, papas));
        when(mermaRepository.findAll()).thenReturn(List.of(mermaPollo));
        when(insumoRepository.findCriticos()).thenReturn(List.of());

        RentabilidadInventarioResponse balance = analisisService.obtenerBalanceRentabilidad();

        // 20*15 + 50*2 = 300 + 100 = 400.00
        assertThat(balance.getValorTotalInventario()).isEqualByComparingTo("400.00");
        // 2*15 = 30.00
        assertThat(balance.getCostoTotalMermas()).isEqualByComparingTo("30.00");
        assertThat(balance.getTotalInsumos()).isEqualTo(2);
        assertThat(balance.getTotalInsumosCriticos()).isEqualTo(0);
    }
}
