package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RF18 — El panel administrativo solo puede asignar un motorizado que exista.
 *
 * El roster de repartidores se expone en {@code GET /auth/admin/repartidores}. Es un listado de
 * personas (nombre y teléfono), así que la única autoridad que puede leerlo es el ADMIN: sin esa
 * guarda cualquier cliente autenticado podría enumerar a todo el personal de reparto.
 *
 * El contrato verificado aquí es el que consume el modal de asignación del panel:
 * {@code [{ id, nombre, email, telefono }]} con los repartidores ACTIVOS y solo ellos.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("RF18 - GET /auth/admin/repartidores esta reservado al ADMIN")
class RepartidoresAdminTest {

    private static final String EMAIL_ADMIN = "admin.roster.test@yopmail.com";
    private static final String EMAIL_MOZO = "mozo.roster.test@yopmail.com";
    private static final String EMAIL_REPARTIDOR_ACTIVO = "rider.activo.test@yopmail.com";
    private static final String EMAIL_REPARTIDOR_INACTIVO = "rider.inactivo.test@yopmail.com";
    private static final String EMAIL_REPARTIDOR_PRUEBAS = "repartidor.polleria@yopmail.com";
    private static final String RUTA = "/auth/admin/repartidores";

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private UserRepository userRepository;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @AfterEach
    void limpiarUsuariosDePrueba() {
        for (String email : List.of(EMAIL_ADMIN, EMAIL_MOZO, EMAIL_REPARTIDOR_ACTIVO, EMAIL_REPARTIDOR_INACTIVO)) {
            userRepository.findByEmail(email).ifPresent(userRepository::delete);
        }
    }

    @Test
    @DisplayName("El ADMIN recibe solo los repartidores activos, con nombre y telefono")
    void adminListaRepartidoresActivos() {
        crearUsuario(EMAIL_REPARTIDOR_ACTIVO, "Rider Activo Prueba", "977000001", Role.REPARTIDOR, true);
        crearUsuario(EMAIL_REPARTIDOR_INACTIVO, "Rider Inactivo Prueba", "977000002", Role.REPARTIDOR, false);
        crearUsuario(EMAIL_MOZO, "Mozo Prueba", "977000003", Role.MOZO, true);
        crearUsuario(EMAIL_ADMIN, "Admin Prueba", "977000004", Role.ADMIN, true);

        ResponseEntity<List<Map<String, Object>>> respuesta = rest.exchange(
                RUTA, HttpMethod.GET, new HttpEntity<>(cabeceraConToken(EMAIL_ADMIN)), listaDeMapas()
        );

        assertEquals(HttpStatus.OK, respuesta.getStatusCode(), "El ADMIN debe poder leer el roster");
        List<Map<String, Object>> roster = respuesta.getBody();
        assertNotNull(roster, "El roster no debe ser nulo");

        List<String> correos = roster.stream().map(r -> String.valueOf(r.get("email"))).toList();
        assertTrue(correos.contains(EMAIL_REPARTIDOR_ACTIVO),
                "El repartidor activo debe aparecer en el roster. Roster: " + correos);
        assertFalse(correos.contains(EMAIL_REPARTIDOR_INACTIVO),
                "Un repartidor dado de baja no debe ofrecerse para asignar. Roster: " + correos);
        assertFalse(correos.contains(EMAIL_MOZO), "Un mozo no es un motorizado. Roster: " + correos);
        assertFalse(correos.contains(EMAIL_ADMIN), "El admin no es un motorizado. Roster: " + correos);

        Map<String, Object> rider = roster.stream()
                .filter(r -> EMAIL_REPARTIDOR_ACTIVO.equals(r.get("email")))
                .findFirst()
                .orElseThrow();
        assertNotNull(rider.get("id"), "El modal necesita el id para PATCH /ordenes/{id}/estado");
        assertEquals("Rider Activo Prueba", rider.get("nombre"), "El panel muestra el nombre del motorizado");
        assertEquals("977000001", rider.get("telefono"), "El panel muestra el telefono del motorizado");
    }

    @Test
    @DisplayName("Un usuario autenticado que no es ADMIN recibe 403")
    void personalSinRolAdminNoPuedeLeerElRoster() {
        crearUsuario(EMAIL_MOZO, "Mozo Prueba", "977000013", Role.MOZO, true);

        ResponseEntity<String> respuesta = rest.exchange(
                RUTA, HttpMethod.GET, new HttpEntity<>(cabeceraConToken(EMAIL_MOZO)), String.class
        );

        assertEquals(HttpStatus.FORBIDDEN, respuesta.getStatusCode(),
                "Un mozo autenticado no debe poder enumerar a los motorizados");
    }

    @Test
    @DisplayName("Sin token la peticion no se atiende")
    void anonimoNoPuedeLeerElRoster() {
        ResponseEntity<String> respuesta = rest.getForEntity(RUTA, String.class);

        assertTrue(respuesta.getStatusCode().is4xxClientError(),
                "Sin token el roster no debe servirse, pero respondio " + respuesta.getStatusCode());
    }

    private void crearUsuario(String email, String nombre, String telefono, Role rol, boolean activo) {
        userRepository.findByEmail(email).ifPresent(userRepository::delete);
        userRepository.save(User.builder()
                .name(nombre)
                .email(email)
                .phone(telefono)
                .password("$2a$10$hashDePruebasNoSeUsaParaLogin")
                .role(rol)
                .active(activo)
                .build());
    }

    private HttpHeaders cabeceraConToken(String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(firmarToken(email));
        return headers;
    }

    /** Mismo secreto que el servicio: el JwtAuthFilter valida la firma y recarga el rol desde la base. */
    private String firmarToken(String email) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 600_000))
                .signWith(key)
                .compact();
    }

    private ParameterizedTypeReference<List<Map<String, Object>>> listaDeMapas() {
        return new ParameterizedTypeReference<>() { };
    }
}
