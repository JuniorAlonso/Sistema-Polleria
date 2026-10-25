package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.WhatsappNotificationClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@DisplayName("Seguridad - Endpoints de Pago con Rol CAJERO")
class PagoCajeroSecurityTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PagoRepository pagoRepository;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @AfterEach
    void tearDown() {
        pagoRepository.deleteAll();
    }

    private String generarToken(String email, String role, Long userId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .signWith(key)
                .compact();
    }

    private HttpHeaders headersConRol(String role, Long userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(generarToken(role.toLowerCase() + "@polleria.com", role, userId));
        return headers;
    }

    private Pago crearPago(Long ordenId, Long clienteId, String monto) {
        Pago pago = new Pago();
        pago.setOrdenId(ordenId);
        pago.setClienteId(clienteId);
        pago.setMonto(new BigDecimal(monto));
        pago.setMetodoPago(MetodoPago.CONTRAENTREGA);
        pago.setEstado(EstadoPago.PENDIENTE);
        return pagoRepository.save(pago);
    }

    @Test
    @DisplayName("CAJERO puede listar todos los pagos; CLIENTE recibe 403")
    void listarPagos_cajeroAutorizado_clienteProhibido() {
        crearPago(101L, 5L, "65.50");

        // Cajero
        ResponseEntity<List> resCajero = restTemplate.exchange(
                "/pagos",
                HttpMethod.GET,
                new HttpEntity<>(headersConRol("CAJERO", 2L)),
                List.class
        );
        assertEquals(HttpStatus.OK, resCajero.getStatusCode());
        assertNotNull(resCajero.getBody());

        // Cliente
        ResponseEntity<String> resCliente = restTemplate.exchange(
                "/pagos",
                HttpMethod.GET,
                new HttpEntity<>(headersConRol("CLIENTE", 5L)),
                String.class
        );
        assertEquals(HttpStatus.FORBIDDEN, resCliente.getStatusCode());
    }

    @Test
    @DisplayName("CAJERO puede consultar pago por ordenId")
    void obtenerPorOrden_cajeroAutorizado() {
        crearPago(102L, 6L, "42.00");

        ResponseEntity<String> resCajero = restTemplate.exchange(
                "/pagos/orden/102",
                HttpMethod.GET,
                new HttpEntity<>(headersConRol("CAJERO", 2L)),
                String.class
        );
        assertEquals(HttpStatus.OK, resCajero.getStatusCode());
    }

    @Test
    @DisplayName("CAJERO puede confirmar un pago en caja; CLIENTE recibe 403")
    void confirmarPago_cajeroAutorizado_clienteProhibido() {
        Pago pago = crearPago(103L, 7L, "88.00");

        ConfirmarPagoRequest req = new ConfirmarPagoRequest("CAJA-TICKET-001", "Pago en efectivo en caja");

        // Cliente intenta confirmar -> 403
        ResponseEntity<String> resCliente = restTemplate.exchange(
                "/pagos/" + pago.getId() + "/confirmar",
                HttpMethod.PATCH,
                new HttpEntity<>(req, headersConRol("CLIENTE", 7L)),
                String.class
        );
        assertEquals(HttpStatus.FORBIDDEN, resCliente.getStatusCode());

        // Cajero confirma -> 200 OK
        ResponseEntity<String> resCajero = restTemplate.exchange(
                "/pagos/" + pago.getId() + "/confirmar",
                HttpMethod.PATCH,
                new HttpEntity<>(req, headersConRol("CAJERO", 2L)),
                String.class
        );
        assertEquals(HttpStatus.OK, resCajero.getStatusCode());

        Pago actualizado = pagoRepository.findById(pago.getId()).orElseThrow();
        assertEquals(EstadoPago.APROBADO, actualizado.getEstado());
    }
}
