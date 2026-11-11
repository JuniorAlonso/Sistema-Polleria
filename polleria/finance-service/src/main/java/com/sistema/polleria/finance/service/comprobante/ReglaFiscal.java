package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;

import java.math.BigDecimal;

/**
 * Tax-data rule for one receipt type (D3.8). A new receipt type adds a new rule bean instead of
 * changing {@link ValidadorDatosFiscales}.
 */
public interface ReglaFiscal {

    TipoComprobante tipo();

    /** Throws {@link IllegalArgumentException} (400) when the document does not meet the rule. */
    void validar(String numeroDocumento, BigDecimal total);
}
