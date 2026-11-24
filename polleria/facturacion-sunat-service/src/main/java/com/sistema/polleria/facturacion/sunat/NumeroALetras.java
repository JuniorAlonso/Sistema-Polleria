package com.sistema.polleria.facturacion.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Convierte el total a letras: 123.50 → "CIENTO VEINTITRES CON 50/100 SOLES".
 *
 * <p>SUNAT lo pide como "leyenda 1000" dentro del XML, y además se imprime en el ticket,
 * igual que en las facturas de papel.
 */
public final class NumeroALetras {

    private static final String[] UNIDADES = {"", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
            "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
            "VEINTE", "VEINTIUNO", "VEINTIDOS", "VEINTITRES", "VEINTICUATRO", "VEINTICINCO", "VEINTISEIS", "VEINTISIETE",
            "VEINTIOCHO", "VEINTINUEVE"};
    private static final String[] DECENAS = {"", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
            "OCHENTA", "NOVENTA"};
    private static final String[] CENTENAS = {"", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
            "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"};

    private NumeroALetras() {
    }

    public static String soles(BigDecimal monto) {
        if (monto == null || monto.signum() < 0) {
            throw new IllegalArgumentException("El monto en letras debe ser mayor o igual a cero");
        }
        BigDecimal redondeado = monto.setScale(2, RoundingMode.HALF_UP);
        long entero = redondeado.longValue();
        int centimos = redondeado.subtract(BigDecimal.valueOf(entero)).movePointRight(2).intValue();
        String letras = entero == 0 ? "CERO" : convertir(entero);
        return letras + " CON " + String.format("%02d", centimos) + "/100 SOLES";
    }

    private static String convertir(long n) {
        if (n >= 1_000_000) {
            long millones = n / 1_000_000;
            String texto = millones == 1 ? "UN MILLON" : apocopar(convertir(millones)) + " MILLONES";
            long resto = n % 1_000_000;
            return resto == 0 ? texto : texto + " " + convertir(resto);
        }
        if (n >= 1000) {
            long miles = n / 1000;
            String texto = miles == 1 ? "MIL" : apocopar(menorQueMil((int) miles)) + " MIL";
            long resto = n % 1000;
            return resto == 0 ? texto : texto + " " + menorQueMil((int) resto);
        }
        return menorQueMil((int) n);
    }

    private static String menorQueMil(int n) {
        if (n == 100) {
            return "CIEN";
        }
        String centena = CENTENAS[n / 100];
        int resto = n % 100;
        String decenas;
        if (resto < 30) {
            decenas = UNIDADES[resto];
        } else {
            decenas = DECENAS[resto / 10] + (resto % 10 == 0 ? "" : " Y " + UNIDADES[resto % 10]);
        }
        return (centena + " " + decenas).trim();
    }

    /** Delante de MIL o MILLONES "UNO" se vuelve "UN": "VEINTIUN MIL", no "VEINTIUNO MIL". */
    private static String apocopar(String texto) {
        return texto.endsWith("UNO") ? texto.substring(0, texto.length() - 1) : texto;
    }
}
