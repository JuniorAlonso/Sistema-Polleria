package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.service.OrdenesClient;
import com.sistema.polleria.finance.service.PagosClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * The approved payment amount, or the order total while nothing has been charged yet: the
 * cash-on-delivery boleta is issued when the call is confirmed, before the courier collects (D3.15).
 * If payments-service cannot answer, it fails closed instead of guessing from the order.
 */
@Component
@RequiredArgsConstructor
public class FuenteTotalPagoUOrden implements FuenteTotalComprobante {

    private static final String APROBADO = "APROBADO";

    private final PagosClient pagosClient;
    private final OrdenesClient ordenesClient;

    @Override
    public BigDecimal totalDe(Long ordenId, String bearer) {
        return pagosClient.obtenerPagoDeOrden(ordenId, bearer)
                .filter(pago -> APROBADO.equals(pago.estado()) && pago.monto() != null)
                .map(PagosClient.PagoOrden::monto)
                .orElseGet(() -> ordenesClient.obtenerTotal(ordenId));
    }
}
