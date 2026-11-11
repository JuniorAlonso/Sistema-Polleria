package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.PagoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Set;

/**
 * Owner check for payment reads (D3.7). Staff roles read any payment. A {@code CLIENTE} reads a
 * payment it created ({@code pagos.cliente_id}) or one of an order it owns ({@code ordenes.cliente_id}),
 * because staff also start payments for customers (cash on delivery). Kept out of
 * {@link PagoService} so the shared service does not change; Plan 6 reuses it in {@code sincronizar}.
 */
@Component
@RequiredArgsConstructor
public class AutorizacionPago {

    private static final Set<String> PERSONAL = Set.of("ADMIN", "CAJERO", "MOZO", "REPARTIDOR", "INTERNAL");

    private final OrdenesClient ordenesClient;

    public void verificarLectura(PagoResponse pago, Authentication authentication) {
        if (esPersonal(authentication)) {
            return;
        }
        Long usuarioId = usuarioId(authentication);
        if (usuarioId != null && (Objects.equals(usuarioId, pago.clienteId()) || esDuenoDeLaOrden(pago.ordenId(), usuarioId))) {
            return;
        }
        throw new AccessDeniedException("No puedes consultar un pago que no es tuyo");
    }

    /** Fails closed: when the order cannot be read, the customer is not treated as its owner. */
    public boolean esDuenoDeLaOrden(Long ordenId, Long usuarioId) {
        try {
            OrdenesClient.OrdenInfo orden = ordenesClient.obtener(ordenId);
            return orden != null && Objects.equals(usuarioId, orden.clienteId());
        } catch (RuntimeException e) {
            return false;
        }
    }

    public static boolean esPersonal(Authentication authentication) {
        return authentication != null && authentication.getAuthorities() != null
                && authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                        .anyMatch(PERSONAL::contains);
    }

    public static Long usuarioId(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        Object credenciales = authentication.getCredentials();
        if (credenciales instanceof Long id) {
            return id;
        }
        if (credenciales instanceof Integer id) {
            return id.longValue();
        }
        return null;
    }
}
