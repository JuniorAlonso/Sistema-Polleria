package com.sistema.polleria.orders.util;

import java.util.List;

/**
 * Los teléfonos se guardan como los escribe el cliente (987654321, 51987654321, +51 987...).
 * Estas utilidades permiten compararlos sin importar el formato.
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

    /** Formatos con los que el mismo celular puede estar guardado en la base de datos. */
    public static List<String> variantes(String telefono) {
        String n = normalizar(telefono);
        if (n == null) return List.of();
        return List.of(n, "51" + n, "+51" + n, "+51 " + n);
    }

    /**
     * Clave canónica del celular: la forma normalizada, o los últimos 9 dígitos cuando el
     * formato no se puede normalizar. Se usa tanto para numerar pedidos como para el índice
     * único, de modo que "(01) 987654321" y "987654321" compartan clave y no abran dos
     * secuencias distintas para el mismo cliente.
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
