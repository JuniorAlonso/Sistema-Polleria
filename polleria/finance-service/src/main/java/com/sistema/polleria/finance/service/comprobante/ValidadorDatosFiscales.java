package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Picks the {@link ReglaFiscal} of the receipt type and applies it (D3.8). */
@Component
public class ValidadorDatosFiscales {

    private final Map<TipoComprobante, ReglaFiscal> reglas = new EnumMap<>(TipoComprobante.class);

    public ValidadorDatosFiscales(List<ReglaFiscal> reglas) {
        reglas.forEach(regla -> this.reglas.put(regla.tipo(), regla));
    }

    public void validar(TipoComprobante tipo, String numeroDocumento, BigDecimal total) {
        ReglaFiscal regla = reglas.get(tipo);
        if (regla == null) {
            throw new IllegalArgumentException("Tipo de comprobante no soportado: " + tipo);
        }
        regla.validar(numeroDocumento == null ? null : numeroDocumento.trim(), total);
    }
}
