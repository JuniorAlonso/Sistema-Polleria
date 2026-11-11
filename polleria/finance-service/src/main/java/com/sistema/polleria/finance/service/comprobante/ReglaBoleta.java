package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.entity.TipoComprobante;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Boleta: issued to the final consumer by default. Above S/ 700 the buyer must be identified with a
 * real DNI (article 15 of the Receipts Regulation, R.S. 303-2018/SUNAT).
 */
@Component
public class ReglaBoleta implements ReglaFiscal {

    static final BigDecimal TOPE_CONSUMIDOR_FINAL = new BigDecimal("700.00");

    @Override
    public TipoComprobante tipo() {
        return TipoComprobante.BOLETA;
    }

    @Override
    public void validar(String numeroDocumento, BigDecimal total) {
        if (total.compareTo(TOPE_CONSUMIDOR_FINAL) <= 0) {
            return;
        }
        if (numeroDocumento == null || !numeroDocumento.matches("\\d{8}") || numeroDocumento.matches("0{8}")) {
            throw new IllegalArgumentException(
                    "Una boleta de más de S/ 700 exige el DNI real del comprador (8 dígitos)");
        }
    }
}
