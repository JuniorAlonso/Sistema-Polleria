package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.NoSuchElementException;
import java.util.Objects;

/**
 * A charge must match the current order total (plan 03, 4.1 step 3). The POS can hold a stale total
 * after a new round of items; charging it would leave the receipt and the cash out of step. Runs in
 * the controller before {@link PagoService#iniciar}, so the shared service does not change.
 *
 * <p>A customer only gets past here for its own order: otherwise the answer is the same 404 as for a
 * missing order, so the 409 message never reveals another customer's total.
 */
@Component
@RequiredArgsConstructor
public class ValidadorMontoPago {

    private final OrdenesClient ordenesClient;

    /**
     * @throws IllegalStateException (409) when the amount differs from the order total
     * @throws NoSuchElementException (404) when the order does not exist or is not the customer's
     * @throws OrdenesClient.OrdenNoDisponibleException (503) when orders-service cannot answer
     */
    public void validar(IniciarPagoRequest request, Authentication authentication) {
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(request.ordenId());
        if (orden == null || orden.total() == null) {
            throw new OrdenesClient.OrdenNoDisponibleException(
                    "No se pudo verificar el total de la orden " + request.ordenId(), null);
        }
        if (!AutorizacionPago.esPersonal(authentication)
                && !Objects.equals(AutorizacionPago.usuarioId(authentication), orden.clienteId())) {
            throw new NoSuchElementException("Orden no encontrada: " + request.ordenId());
        }
        exigirTotal(request.monto(), orden);
    }

    /**
     * Same rule when a payment created earlier (for example at checkout) is confirmed later: the
     * order may have grown since. An already approved payment is left to the service's idempotency.
     * Confirmation is staff-only, so the message may show the order total.
     */
    public void validarConfirmacion(PagoResponse pago) {
        if (pago.estado() == EstadoPago.APROBADO) {
            return;
        }
        OrdenesClient.OrdenInfo orden = ordenesClient.obtener(pago.ordenId());
        if (orden == null || orden.total() == null) {
            throw new OrdenesClient.OrdenNoDisponibleException(
                    "No se pudo verificar el total de la orden " + pago.ordenId(), null);
        }
        exigirTotal(pago.monto(), orden);
    }

    private static void exigirTotal(BigDecimal monto, OrdenesClient.OrdenInfo orden) {
        if (orden.total().compareTo(monto) != 0) {
            throw new IllegalStateException("El monto S/ " + monto + " no coincide con el total"
                    + " actual de la orden (S/ " + orden.total() + "). Actualiza la comanda y vuelve a cobrar.");
        }
    }
}
