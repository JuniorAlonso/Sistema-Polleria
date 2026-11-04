package com.sistema.polleria.orders.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * S3 — Ningún {@code SecurityConfig} puede traer un valor por defecto para {@code cors.allowed-origins}.
 *
 * El default comodín {@code *} era un fallback latente: si la propiedad no resolviera,
 * {@code setAllowedOriginPatterns} habilitaría TODOS los orígenes del mundo y, con
 * {@code allowCredentials(true)}, el navegador reflejaría cualquier origen. Sin valor por defecto el
 * servicio falla al arrancar en vez de aceptar un origen ajeno: falla cerrado.
 *
 * La comprobación es sobre los archivos que se despliegan, no sobre el contexto arrancado: los
 * perfiles de prueba fijan su propio {@code cors.allowed-origins} y enmascararían el default real.
 * Por eso el test recorre los siete {@code SecurityConfig} del reactor.
 */
class OrigenesCorsSinDefaultComodinTest {

    private static final List<String> SERVICIOS = List.of(
            "auth-service", "orders-service", "payments-service", "feedback-service",
            "inventory-service", "finance-service", "incident-service");

    /** Declaración correcta, sin nada después de los dos puntos. */
    private static final String DECLARACION_EXACTA = "@Value(\"${cors.allowed-origins}\")";

    /**
     * Captura lo declarado dentro de {@code @Value("...")} en cualquier línea que mencione
     * {@code cors.allowed-origins}; el grupo 1 revela si hay un default tras los dos puntos.
     *
     * Se revisan **todas** las coincidencias del archivo, no solo la primera: un segundo
     * {@code @Value} con comodín en el mismo archivo también es un agujero, y quedarse con la
     * primera declaración lo dejaría pasar.
     */
    private static final Pattern DECLARACION = Pattern.compile(
            "@Value\\(\\s*\"(\\$\\{cors\\.allowed-origins[^\"]*)\"\\s*\\)");

    @Test
    void ningunServicioTraeUnDefaultComodinParaLosOrigenesCors() throws IOException {
        Path raizPolleria = raizDelReactor();

        List<String> infracciones = new ArrayList<>();
        for (String servicio : SERVICIOS) {
            Path securityConfig = raizPolleria
                    .resolve(servicio)
                    .resolve("src/main/java")
                    .resolve(paqueteDelServicio(servicio))
                    .resolve("config/SecurityConfig.java");

            if (!Files.isRegularFile(securityConfig)) {
                infracciones.add(servicio + ": no se encontró " + securityConfig);
                continue;
            }

            infracciones.addAll(revisar(servicio + "/SecurityConfig.java", securityConfig));
        }

        assertTrue(infracciones.isEmpty(),
                "cors.allowed-origins no puede tener un valor por defecto (el comodín habilitaría "
                        + "todos los orígenes):\n  " + String.join("\n  ", infracciones));
    }

    /** Infracciones del archivo indicado; vacío si declara la propiedad sin default. */
    private List<String> revisar(String etiqueta, Path archivo) throws IOException {
        Matcher valor = DECLARACION.matcher(Files.readString(archivo, StandardCharsets.UTF_8));

        List<String> infracciones = new ArrayList<>();
        boolean encontrada = false;
        while (valor.find()) {
            encontrada = true;
            String declarado = valor.group(1).trim();
            if (!"${cors.allowed-origins}".equals(declarado)) {
                infracciones.add(etiqueta + ": declara " + declarado
                        + "  (debe ser exactamente ${cors.allowed-origins}, sin valor por defecto)");
            }
        }

        if (!encontrada) {
            infracciones.add(etiqueta + ": no declara " + DECLARACION_EXACTA);
        }
        return infracciones;
    }

    /** Cada servicio tiene su propio paquete base bajo {@code src/main/java}. */
    private String paqueteDelServicio(String servicio) {
        return "com/sistema/polleria/" + servicio.replace("-service", "") + "/";
    }

    /** El directorio del módulo durante la prueba es {@code <repo>/polleria/orders-service}. */
    private Path raizDelReactor() {
        Path modulo = Paths.get("").toAbsolutePath();
        Path raiz = modulo.getParent();
        if (raiz == null || !Files.isDirectory(raiz.resolve("orders-service"))) {
            fail("No se pudo ubicar la raíz del reactor Maven desde " + modulo
                    + "; el test lee los SecurityConfig de los siete servicios");
        }
        try (Stream<Path> contenido = Files.list(raiz)) {
            assertTrue(contenido.anyMatch(p -> p.getFileName().toString().equals("pom.xml")),
                    "El directorio padre del módulo debe ser la raíz del reactor (con pom.xml)");
        } catch (IOException e) {
            fail("No se pudo inspeccionar " + raiz + ": " + e.getMessage());
        }
        return raiz;
    }
}
