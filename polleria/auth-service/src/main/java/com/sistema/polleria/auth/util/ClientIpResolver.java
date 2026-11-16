package com.sistema.polleria.auth.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resuelve la IP real del cliente sin confiar en {@code X-Forwarded-For}
 * salvo cuando el servicio corre detrás de un proxy explícitamente confiable.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request, boolean trustForwardedHeader) {
        if (trustForwardedHeader) {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                return xForwardedFor.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr();
    }
}
