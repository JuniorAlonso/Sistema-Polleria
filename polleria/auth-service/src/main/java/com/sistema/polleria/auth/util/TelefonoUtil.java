package com.sistema.polleria.auth.util;

import java.util.List;

/**
 * Normalización de números telefónicos peruanos para auditoría y listas de sanción.
 */
public final class TelefonoUtil {

    private TelefonoUtil() {}

    /** Devuelve el celular peruano de 9 dígitos (9XXXXXXXX) o null si no es válido. */
    public static String normalizar(String telefono) {
        if (telefono == null) return null;
        String digitos = telefono.replaceAll("\\D", "");
        if (digitos.length() == 11 && digitos.startsWith("51")) {
            digitos = digitos.substring(2);
        }
        return digitos.matches("9\\d{8}") ? digitos : null;
    }

    /** Formatos con los que el mismo celular puede registrarse. */
    public static List<String> variantes(String telefono) {
        String n = normalizar(telefono);
        if (n == null) return List.of();
        return List.of(n, "51" + n, "+51" + n, "+51 " + n);
    }

    /**
     * Clave canónica del celular: los 9 dígitos normalizados o los últimos 9 dígitos
     * para asegurar coincidencia independientemente del prefijo ingresado.
     */
    public static String canonico(String telefono) {
        String normalizado = normalizar(telefono);
        if (normalizado != null) return normalizado;
        if (telefono == null) return null;
        String digitos = telefono.replaceAll("\\D", "");
        if (digitos.isBlank()) return null;
        return digitos.length() > 9 ? digitos.substring(digitos.length() - 9) : digitos;
    }
}
