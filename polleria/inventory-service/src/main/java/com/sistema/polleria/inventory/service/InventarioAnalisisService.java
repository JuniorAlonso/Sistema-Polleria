package com.sistema.polleria.inventory.service;

import com.sistema.polleria.inventory.dto.AlertaStockResponse;
import com.sistema.polleria.inventory.dto.RentabilidadInventarioResponse;
import com.sistema.polleria.inventory.entity.Insumo;
import com.sistema.polleria.inventory.entity.Merma;
import com.sistema.polleria.inventory.repository.InsumoRepository;
import com.sistema.polleria.inventory.repository.MermaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventarioAnalisisService {

    private final InsumoRepository insumoRepository;
    private final MermaRepository mermaRepository;

    public List<AlertaStockResponse> obtenerAlertasStock() {
        List<Insumo> criticos = insumoRepository.findCriticos();
        List<AlertaStockResponse> alertas = new ArrayList<>();

        for (Insumo i : criticos) {
            String nivel = i.getStockActual().compareTo(BigDecimal.ZERO) <= 0 ? "CRITICO" : "ALTO";
            String msg = String.format("⚠️ Alerta de abastecimiento: Stock crítico de %s. Quedan %s %s (umbral mínimo: %s %s)",
                    i.getNombre(), i.getStockActual(), i.getUnidadMedida(), i.getStockMinimoAlerta(), i.getUnidadMedida());

            alertas.add(AlertaStockResponse.builder()
                    .insumoId(i.getId())
                    .insumoNombre(i.getNombre())
                    .stockActual(i.getStockActual())
                    .stockMinimoAlerta(i.getStockMinimoAlerta())
                    .unidadMedida(i.getUnidadMedida())
                    .nivelCriticidad(nivel)
                    .mensaje(msg)
                    .build());
        }

        return alertas;
    }

    public RentabilidadInventarioResponse obtenerBalanceRentabilidad() {
        List<Insumo> insumos = insumoRepository.findAll();
        List<Merma> mermas = mermaRepository.findAll();

        BigDecimal valorTotal = BigDecimal.ZERO;
        for (Insumo i : insumos) {
            if (i.getStockActual() != null && i.getCostoUnitario() != null) {
                valorTotal = valorTotal.add(i.getStockActual().multiply(i.getCostoUnitario()));
            }
        }

        BigDecimal costoMermas = BigDecimal.ZERO;
        for (Merma m : mermas) {
            Insumo insumo = insumos.stream()
                    .filter(i -> i.getId().equals(m.getInsumoId()))
                    .findFirst().orElse(null);
            if (insumo != null && insumo.getCostoUnitario() != null) {
                costoMermas = costoMermas.add(m.getCantidad().multiply(insumo.getCostoUnitario()));
            }
        }

        List<AlertaStockResponse> alertas = obtenerAlertasStock();

        return RentabilidadInventarioResponse.builder()
                .valorTotalInventario(valorTotal)
                .costoTotalMermas(costoMermas)
                .totalInsumos(insumos.size())
                .totalInsumosCriticos(alertas.size())
                .alertasCriticas(alertas)
                .build();
    }
}
