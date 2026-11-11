package com.sistema.polleria.finance.service.comprobante;

import java.math.BigDecimal;

/**
 * Where the receipt total comes from (D3.15). The browser never decides it: the receipt must match
 * what was actually charged.
 */
public interface FuenteTotalComprobante {

    /**
     * @param bearer the caller's {@code Authorization} header, forwarded to services that check roles
     */
    BigDecimal totalDe(Long ordenId, String bearer);
}
