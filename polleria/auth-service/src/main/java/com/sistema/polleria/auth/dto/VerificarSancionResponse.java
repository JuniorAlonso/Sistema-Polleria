package com.sistema.polleria.auth.dto;

/** Public answer of the sanction check: flags only, never personal data nor the reason. */
public record VerificarSancionResponse(
        boolean sancionado,
        boolean bloqueadoEfectivo,
        boolean bloqueadoTotal
) {
    public static VerificarSancionResponse sinSancion() {
        return new VerificarSancionResponse(false, false, false);
    }
}
