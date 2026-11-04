package com.sistema.polleria.orders.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * D2 — La clave interna entre microservicios no puede tener un valor por defecto conocido.
 *
 * Antes, {@code internal.api-key} valía {@code polleria-dev-internal-key} cuando faltaba
 * {@code INTERNAL_API_KEY}. {@code JwtAuthFilter} convierte cualquier petición que traiga esa
 * cabecera en un principal con autoridad {@code ADMIN}, así que un valor por defecto público
 * equivale a un pase libre de administrador para cualquiera que leyera el repositorio.
 *
 * Esta prueba levanta el contexto SIN clave interna configurada y comprueba que la petición
 * no queda autenticada.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "internal.api-key=")
@ActiveProfiles("test")
class ClaveInternaFailClosedTest {

    private static final String CLAVE_INTERNA = "X-Internal-Key";

    @Autowired
    private TestRestTemplate rest;

    @Test
    void sinClaveInternaConfiguradaLaCabeceraNoAutentica() {
        HttpHeaders cabeceras = new HttpHeaders();
        cabeceras.set(CLAVE_INTERNA, "polleria-dev-internal-key");

        ResponseEntity<String> respuesta = rest.exchange(
                "/mesas", HttpMethod.GET, new HttpEntity<>(cabeceras), String.class);

        assertEquals(HttpStatus.FORBIDDEN, respuesta.getStatusCode(),
                "sin INTERNAL_API_KEY definida, la cabecera debe quedar sin autenticar "
                        + "en lugar de conceder ADMIN: " + respuesta.getBody());
    }

    /**
     * El perfil de pruebas fija su propia clave, así que el defecto real (el valor por defecto
     * del archivo que se despliega) no lo ve ninguna prueba de comportamiento: hay que leer la
     * configuración que viaja en el artefacto.
     */
    @Test
    void laConfiguracionDesplegadaNoTraeUnaClaveInternaPorDefecto() throws Exception {
        String properties = new String(
                new ClassPathResource("application.properties").getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);

        Matcher valor = Pattern.compile("^internal\\.api-key\\s*=\\s*(.+)$", Pattern.MULTILINE)
                .matcher(properties);

        assertTrue(valor.find(), "application.properties debe declarar internal.api-key");
        assertEquals("${INTERNAL_API_KEY:}", valor.group(1).trim(),
                "internal.api-key no puede tener un valor por defecto conocido: cualquiera que "
                        + "lea el repositorio se convertiría en ADMIN enviando esa cabecera");
    }
}
