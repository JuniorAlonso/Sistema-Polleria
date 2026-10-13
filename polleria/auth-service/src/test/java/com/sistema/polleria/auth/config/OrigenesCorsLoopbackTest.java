package com.sistema.polleria.auth.config;

import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * S4/S5 — El panel Angular corre en la misma máquina que el servicio, pero `ng serve` cambia
 * de puerto cuando 4200 está ocupado y el usuario puede abrir la app por `127.0.0.1` o `[::1]`.
 * Con la lista exacta de `cors.allowed-origins`, el preflight respondía 403 sin
 * `Access-Control-Allow-Origin`, el navegador nunca enviaba el POST y el login no llegaba al
 * backend. La política debe aceptar cualquier puerto de loopback sin habilitar un origen externo.
 *
 * El método bajo prueba es estático y puro: no se levanta el contexto de Spring.
 */
class OrigenesCorsLoopbackTest {

    private static final String CONFIGURADOS = "http://localhost:4200";

    private static CorsConfiguration configuracion() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(SecurityConfig.origenesPermitidos(CONFIGURADOS));
        config.setAllowCredentials(true);
        return config;
    }

    @Test
    void aceptaLocalhostEnOtroPuertoCuando4200EstaOcupado() {
        CorsConfiguration config = configuracion();
        assertEquals("http://localhost:4300", config.checkOrigin("http://localhost:4300"),
                "ng serve puede arrancar en 4300 cuando 4200 está ocupado");
        assertEquals("http://localhost:4201", config.checkOrigin("http://localhost:4201"),
                "cualquier puerto de loopback debe quedar habilitado");
    }

    @Test
    void aceptaIpv4DeLoopbackAunqueLaListaSoloNombreLocalhost() {
        assertEquals("http://127.0.0.1:4200", configuracion().checkOrigin("http://127.0.0.1:4200"),
                "abrir la app por 127.0.0.1 no debe bloquear el preflight");
    }

    @Test
    void aceptaIpv6DeLoopback() {
        assertEquals("http://[::1]:4200", configuracion().checkOrigin("http://[::1]:4200"),
                "el loopback IPv6 debe quedar habilitado");
    }

    @Test
    void rechazaUnOrigenExterno() {
        assertNull(configuracion().checkOrigin("https://sitio-ajeno.example"),
                "habilitar loopback no puede convertirse en habilitar internet");
    }

    @Test
    void sigueAceptandoLaListaConfigurada() {
        assertEquals("http://localhost:4200", configuracion().checkOrigin("http://localhost:4200"),
                "la lista de cors.allowed-origins debe seguir vigente");
    }
}
