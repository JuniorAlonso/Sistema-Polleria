package com.sistema.polleria.facturacion.sunat;

/**
 * Datos de la empresa que emite el comprobante (la pollería).
 *
 * <p>SUNAT exige que estos datos vayan dentro de cada XML: así sabe quién vende. En el entorno
 * beta se puede usar cualquier RUC de prueba (por ejemplo 20000000001).
 *
 * @param ruc             RUC de 11 dígitos de la pollería
 * @param razonSocial     nombre legal registrado en SUNAT
 * @param nombreComercial nombre de la marca ("El San Pollo")
 * @param direccion       dirección fiscal
 * @param ubigeo          código INEI de 6 dígitos del distrito (Ica - Parcona = 110107)
 * @param departamento    departamento de la dirección fiscal
 * @param provincia       provincia de la dirección fiscal
 * @param distrito        distrito de la dirección fiscal
 */
public record Emisor(
        String ruc,
        String razonSocial,
        String nombreComercial,
        String direccion,
        String ubigeo,
        String departamento,
        String provincia,
        String distrito
) {
}
