package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * A charge must match the current order total (plan 03, 4.1 step 3). The POS can hold a stale total
 * after a new round of items; charging it would leave the receipt and the cash out of step. Runs in
 * the controller before {@link PagoService#iniciar}, so the shared service does not change.
 */
@Component
@RequiredArgsConstructor
public class ValidadorMontoPago {

    private final OrdenesClient ordenesClient;

    /**
     * @throws IllegalStateException (409) when the amount differs from the order total
     * @throws java.util.NoSuchElementException (404) when the order does not exist
     * @throws OrdenesClient.OrdenNoDisponibleException (503) when orders-service cannot answer
     */
    public void validar(IniciarPagoRequest request) {
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(request.ordenId());
        if (orden == null || orden.total() == null) {
            throw new OrdenesClient.OrdenNoDisponibleException(
                    "No se pudo verificar el total de la orden " + request.ordenId(), null);
        }
        if (orden.total().compareTo(request.monto()) != 0) {
            throw new IllegalStateException("El monto S/ " + request.monto() + " no coincide con el total"
                    + " actual de la orden (S/ " + orden.total() + "). Actualiza la comanda y vuelve a cobrar.");
        }
    }
}
