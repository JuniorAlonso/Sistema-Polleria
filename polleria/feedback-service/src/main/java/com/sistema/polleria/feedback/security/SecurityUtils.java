package com.sistema.polleria.feedback.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.security.Principal;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Long obtenerUsuarioIdAutenticado(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth && auth.getCredentials() != null) {
            Object creds = auth.getCredentials();
            if (creds instanceof Number n) {
                return n.longValue();
            }
            try {
                return Long.parseLong(creds.toString());
            } catch (NumberFormatException ignored) {
            }
        }
        throw new AuthenticationCredentialsNotFoundException(
                "Credenciales de autenticación no encontradas o token JWT carece de userId");
    }

    public static boolean esAdmin(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            return auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ADMIN") || a.getAuthority().equals("ROLE_ADMIN"));
        }
        return false;
    }
}
