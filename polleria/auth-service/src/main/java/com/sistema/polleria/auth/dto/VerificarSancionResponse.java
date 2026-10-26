package com.sistema.polleria.auth.dto;

public record VerificarSancionResponse(
        boolean sancionado,
        boolean bloqueadoEfectivo,
        boolean bloqueadoTotal,
        String motivo,
        String telefonoNormalizado
) {
    public static VerificarSancionResponse sinSancion(String telefonoNorm) {
        return new VerificarSancionResponse(false, false, false, null, telefonoNorm);
    }
}
