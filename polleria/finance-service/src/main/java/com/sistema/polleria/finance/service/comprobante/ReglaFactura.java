package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/** Factura: always requires the buyer's 11-digit RUC (D3.8). */
@Component
public class ReglaFactura implements ReglaFiscal {

    @Override
    public TipoComprobante tipo() {
        return TipoComprobante.FACTURA;
    }

    @Override
    public void validar(String numeroDocumento, BigDecimal total) {
        if (numeroDocumento == null || !numeroDocumento.matches("\\d{11}")) {
            throw new IllegalArgumentException("La factura exige un RUC de 11 dígitos");
        }
    }
}
