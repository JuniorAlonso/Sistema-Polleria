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
 * S9 — Ningún servicio puede traer un valor por defecto para {@code jwt.secret}.
 *
 * Esa propiedad es la clave HS256 con la que se firman y validan TODOS los JWT del sistema. Un
 * valor por defecto publicado en el repositorio equivale a que cualquiera pueda forjar un token
 * con rol {@code ADMIN} si el despliegue olvida definir {@code JWT_SECRET}.
 *
 * Sin valor por defecto, Spring no puede resolver el marcador y el servicio **no arranca**: falla
 * cerrado, que es el comportamiento correcto para una clave de firma.
 *
 * La comprobación es sobre los archivos que se despliegan, no sobre el contexto arrancado: los
 * perfiles de prueba fijan su propio {@code jwt.secret} y enmascararían el default real. Por eso
 * el test recorre los siete {@code application.properties} del reactor.
 */
class SecretoJwtSinValorPorDefectoTest {

    private static final List<String> SERVICIOS = List.of(
            "auth-service", "orders-service", "payments-service", "feedback-service",
            "inventory-service", "finance-service", "incident-service");

    private static final Pattern DECLARACION = Pattern.compile("^jwt\\.secret=(.*)$", Pattern.MULTILINE);

    @Test
    void ningunServicioTraeUnValorPorDefectoParaLaClaveDeFirma() throws IOException {
        Path raizPolleria = raizDelReactor();

        List<String> infracciones = new ArrayList<>();
        for (String servicio : SERVICIOS) {
            Path properties = raizPolleria
                    .resolve(servicio)
                    .resolve("src/main/resources/application.properties");

            if (!Files.isRegularFile(properties)) {
                infracciones.add(servicio + ": no se encontró " + properties);
                continue;
            }

            infracciones.addAll(revisar(servicio + "/application.properties", properties, true));

            // application-local.properties está ignorado por git, así que no siempre existe; pero
            // cuando existe NO puede reabrir el agujero: `spring.profiles.active=local` está activo
            // en auth, orders y payments, y el perfil tiene prioridad sobre application.properties.
            Path local = raizPolleria
                    .resolve(servicio)
                    .resolve("src/main/resources/application-local.properties");
            if (Files.isRegularFile(local)) {
                infracciones.addAll(revisar(servicio + "/application-local.properties", local, false));
            }
        }

        assertTrue(infracciones.isEmpty(),
                "La clave de firma compartida no puede tener un valor por defecto conocido:\n  "
                        + String.join("\n  ", infracciones));
    }

    /** Infracciones del archivo indicado; vacío si declara la clave correctamente. */
    private List<String> revisar(String etiqueta, Path archivo, boolean declaracionObligatoria)
            throws IOException {
        Matcher valor = DECLARACION.matcher(Files.readString(archivo, StandardCharsets.UTF_8));
        if (!valor.find()) {
            return declaracionObligatoria
                    ? List.of(etiqueta + ": no declara jwt.secret")
                    : List.of();
        }
        String declarado = valor.group(1).trim();
        if (!"${JWT_SECRET}".equals(declarado)) {
            return List.of(etiqueta + ": jwt.secret=" + declarado
                    + "  (debe ser exactamente ${JWT_SECRET}, sin valor por defecto)");
        }
        return List.of();
    }

    /** El directorio del módulo durante la prueba es {@code <repo>/polleria/orders-service}. */
    private Path raizDelReactor() {
        Path modulo = Paths.get("").toAbsolutePath();
        Path raiz = modulo.getParent();
        if (raiz == null || !Files.isDirectory(raiz.resolve("orders-service"))) {
            fail("No se pudo ubicar la raíz del reactor Maven desde " + modulo
                    + "; el test lee los application.properties de los siete servicios");
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
