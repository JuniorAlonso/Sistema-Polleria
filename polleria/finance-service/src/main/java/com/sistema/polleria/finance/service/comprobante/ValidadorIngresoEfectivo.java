package com.sistema.polleria.finance.service.comprobante;

import com.sistema.polleria.finance.service.PagosClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * A sale income enters the drawer only for an approved cash payment (D3.13). Card and Yape are
 * confirmed by hand and never add to the expected cash, whatever flag the caller sends. Cash
 * payments are stored as {@code CONTRAENTREGA} by payments-service, at the POS and on delivery.
 */
@Component
@RequiredArgsConstructor
public class ValidadorIngresoEfectivo {

    private static final String APROBADO = "APROBADO";
    private static final String EFECTIVO = "CONTRAENTREGA";

    private final PagosClient pagosClient;

    /** @throws IllegalStateException (409) when there is no approved cash payment for the order */
    public void validar(Long ordenId, String bearer) {
        PagosClient.PagoOrden pago = pagosClient.obtenerPagoDeOrden(ordenId, bearer)
                .filter(p -> APROBADO.equals(p.estado()))
                .orElseThrow(() -> new IllegalStateException(
                        "La orden #" + ordenId + " no tiene un pago aprobado: no se registra ingreso en caja"));
        if (!EFECTIVO.equals(pago.metodoPago())) {
            throw new IllegalStateException("El pago de la orden #" + ordenId
                    + " no fue en efectivo: tarjeta y Yape no entran a la caja");
        }
    }
}
