package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.ActualizarStockRequest;
import com.sistema.polleria.inventory.dto.CrearInsumoRequest;
import com.sistema.polleria.inventory.dto.InsumoResponse;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import org.junit.jupiter.api.BeforeEach;
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
class InsumoServiceTest {

    @Mock
    private InsumoRepository insumoRepository;

    @InjectMocks
    private InsumoService insumoService;

    private Insumo insumoBase;

    @BeforeEach
    void setUp() {
        insumoBase = Insumo.builder()
                .id(1L)
                .nombre("Pollo Entero Fresco")
                .unidadMedida("UND")
                .stockActual(new BigDecimal("50.00"))
                .stockMinimoAlerta(new BigDecimal("15.00"))
                .costoUnitario(new BigDecimal("18.50"))
                .build();
    }

    @Test
    @DisplayName("Debe listar todos los insumos mapeados a DTO")
    void listarTodos_retornaListaDtos() {
        when(insumoRepository.findAll()).thenReturn(List.of(insumoBase));

        List<InsumoResponse> res = insumoService.listarTodos();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getNombre()).isEqualTo("Pollo Entero Fresco");
        verify(insumoRepository).findAll();
    }

    @Test
    @DisplayName("Debe crear un insumo cuando el nombre no existe previamente")
    void crear_exitoso() {
        CrearInsumoRequest req = CrearInsumoRequest.builder()
                .nombre("Papas Canchan")
                .unidadMedida("kg")
                .stockActual(new BigDecimal("100.00"))
                .stockMinimoAlerta(new BigDecimal("25.00"))
                .costoUnitario(new BigDecimal("3.20"))
                .build();

        when(insumoRepository.existsByNombre("Papas Canchan")).thenReturn(false);
        when(insumoRepository.save(any(Insumo.class))).thenAnswer(inv -> {
            Insumo saved = inv.getArgument(0);
            saved.setId(2L);
            return saved;
        });

        InsumoResponse res = insumoService.crear(req);

        assertThat(res.getId()).isEqualTo(2L);
        assertThat(res.getNombre()).isEqualTo("Papas Canchan");
        assertThat(res.getUnidadMedida()).isEqualTo("KG");
        verify(insumoRepository).save(any(Insumo.class));
    }

    @Test
    @DisplayName("Debe fallar al crear un insumo si ya existe otro con el mismo nombre")
    void crear_fallaSiDuplicado() {
        CrearInsumoRequest req = CrearInsumoRequest.builder()
                .nombre("Pollo Entero Fresco")
                .unidadMedida("UND")
                .build();

        when(insumoRepository.existsByNombre("Pollo Entero Fresco")).thenReturn(true);

        assertThatThrownBy(() -> insumoService.crear(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ya existe un insumo");

        verify(insumoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe actualizar el stock usando delta positivo y negativo")
    void actualizarStock_delta() {
        when(insumoRepository.findById(1L)).thenReturn(Optional.of(insumoBase));
        when(insumoRepository.save(any(Insumo.class))).thenAnswer(inv -> inv.getArgument(0));

        // Delta positivo (+20) -> 70
        ActualizarStockRequest reqSuma = ActualizarStockRequest.builder()
                .cantidad(new BigDecimal("20.00"))
                .esDelta(true)
                .build();
        InsumoResponse resSuma = insumoService.actualizarStock(1L, reqSuma);
        assertThat(resSuma.getStockActual()).isEqualByComparingTo("70.00");

        // Delta negativo (-30) -> 40
        ActualizarStockRequest reqResta = ActualizarStockRequest.builder()
                .cantidad(new BigDecimal("-30.00"))
                .esDelta(true)
                .build();
        InsumoResponse resResta = insumoService.actualizarStock(1L, reqResta);
        assertThat(resResta.getStockActual()).isEqualByComparingTo("40.00");
    }

    @Test
    @DisplayName("Debe rechazar la actualizacion si el stock final queda en negativo")
    void actualizarStock_fallaSiNegativo() {
        when(insumoRepository.findById(1L)).thenReturn(Optional.of(insumoBase));

        ActualizarStockRequest req = ActualizarStockRequest.builder()
                .cantidad(new BigDecimal("-100.00"))
                .esDelta(true)
                .build();

        assertThatThrownBy(() -> insumoService.actualizarStock(1L, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no puede ser negativo");

        verify(insumoRepository, never()).save(any());
    }
}
