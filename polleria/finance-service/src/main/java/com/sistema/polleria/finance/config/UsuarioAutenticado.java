package com.sistema.polleria.finance.config;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.security.Principal;

/**
 * User id of the request, taken from the JWT {@code userId} claim that {@code JwtAuthFilter} stores as
 * the credentials. There is no fallback user: a token without an id is refused (403) instead of
 * acting as user #1, which made any courier look like courier #1 and signed cash records as #1.
 */
public final class UsuarioAutenticado {

    private UsuarioAutenticado() {
    }

    public static Long id(Principal principal) {
        if (principal instanceof Authentication authentication && authentication.getCredentials() instanceof Long id) {
            return id;
        }
        throw new AccessDeniedException("El token no identifica al usuario");
    }
}
