package com.sistema.polleria.payments.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import com.sistema.polleria.payments.service.AlmacenComprobantes;
import com.sistema.polleria.payments.service.NotificadorOrden;
import com.sistema.polleria.payments.service.OrdenesClient;
import com.sistema.polleria.payments.service.WhatsappNotificationClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * S3 / S6 over real HTTP against the test PostgreSQL: cashier inbox, web upload of the capture and
 * the cash-collection guard. MinIO and orders-service are mocked at their client seams.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ComprobanteWebYBandejaTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";
    private static final long CLIENTE_ID = 7001L;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private OrdenesClient ordenesClient;

    @MockitoBean
    private AlmacenComprobantes almacenComprobantes;

    @MockitoBean
    private NotificadorOrden notificadorOrden;

    @MockitoBean
    private WhatsappNotificationClient whatsappNotificationClient;

    private final List<Long> pagosCreados = new ArrayList<>();

    @AfterEach
    void limpiar() {
        pagosCreados.forEach(id -> pagoRepository.deleteById(id));
        pagosCreados.clear();
    }

    // ─── Cashier inbox ─────────────────────────────────────────────

    @Test
    @DisplayName("S3: GET /pagos?estado=PENDIENTE_VERIFICACION lista solo los pendientes con URL firmada para ADMIN y CAJERO")
    void bandejaDelCajeroFiltraPorEstadoYTraeLaUrl() throws Exception {
        long pendiente = crearPago(980001L, EstadoPago.PENDIENTE_VERIFICACION, "comprobantes/yape/980001/980001-a.jpg");
        long aprobado = crearPago(980002L, EstadoPago.APROBADO, "comprobantes/yape/980002/980002-b.jpg");

        for (String rol : List.of("CAJERO", "ADMIN")) {
            ResponseEntity<String> resp = get("/pagos?estado=PENDIENTE_VERIFICACION", token(rol, 5L));
            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            JsonNode lista = objectMapper.readTree(resp.getBody());
            List<Long> ids = new ArrayList<>();
            lista.forEach(n -> ids.add(n.path("id").asLong()));
            assertThat(ids).contains(pendiente).doesNotContain(aprobado);
            JsonNode fila = null;
            for (JsonNode n : lista) {
                if (n.path("id").asLong() == pendiente) {
                    fila = n;
                }
            }
            assertThat(fila).isNotNull();
            assertThat(fila.path("ordenId").asLong()).isEqualTo(980001L);
            assertThat(fila.path("creadoEn").asText()).isNotBlank();
            assertThat(fila.path("comprobanteUrl").asText()).contains("X-Amz-Signature");
        }
    }

    @Test
    @DisplayName("S3: GET /pagos sin filtro sigue listando todos; un CLIENTE recibe 403 y un estado inválido 400")
    void bandejaSinFiltroRolesYEstadoInvalido() throws Exception {
        long a = crearPago(980003L, EstadoPago.PENDIENTE_VERIFICACION, "comprobantes/yape/980003/980003-a.jpg");
        long b = crearPago(980004L, EstadoPago.APROBADO, "comprobantes/yape/980004/980004-b.jpg");

        ResponseEntity<String> todos = get("/pagos", token("CAJERO", 5L));
        assertThat(todos.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Long> ids = new ArrayList<>();
        objectMapper.readTree(todos.getBody()).forEach(n -> ids.add(n.path("id").asLong()));
        assertThat(ids).contains(a, b);

        assertThat(get("/pagos?estado=PENDIENTE_VERIFICACION", token("CLIENTE", CLIENTE_ID)).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get("/pagos?estado=NO_EXISTE", token("CAJERO", 5L)).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─── Web upload ────────────────────────────────────────────────

    @Test
    @DisplayName("S3: el CLIENTE dueño sube la captura → pago PENDIENTE_VERIFICACION con la clave; no ve la clave en la respuesta")
    void clienteDuenioSubeLaCaptura() throws Exception {
        long ordenId = 980010L;
        when(ordenesClient.obtener(ordenId)).thenReturn(orden(ordenId, CLIENTE_ID, "PENDIENTE_PAGO"));
        when(almacenComprobantes.guardar(eq(ordenId), any())).thenReturn("comprobantes/yape/980010/980010-x.jpg");

        ResponseEntity<String> resp = subir(ordenId, token("CLIENTE", CLIENTE_ID));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = objectMapper.readTree(resp.getBody());
        assertThat(body.path("estado").asText()).isEqualTo("PENDIENTE_VERIFICACION");
        assertThat(body.path("comprobanteClave").asText(null)).isNull();
        Pago pago = pagoRepository.findByOrdenId(ordenId).orElseThrow();
        pagosCreados.add(pago.getId());
        assertThat(pago.getEstado()).isEqualTo(EstadoPago.PENDIENTE_VERIFICACION);
        assertThat(pago.getComprobanteClave()).isEqualTo("comprobantes/yape/980010/980010-x.jpg");
        assertThat(pago.getClienteId()).isEqualTo(CLIENTE_ID);
        assertThat(pago.getMonto()).isEqualByComparingTo("45.50");
    }

    @Test
    @DisplayName("S3: un CLIENTE que no es dueño de la orden recibe 404 y no se guarda nada")
    void clienteAjenoNoPuedeSubir() {
        long ordenId = 980011L;
        when(ordenesClient.obtener(ordenId)).thenReturn(orden(ordenId, CLIENTE_ID + 1, "PENDIENTE_PAGO"));

        ResponseEntity<String> resp = subir(ordenId, token("CLIENTE", CLIENTE_ID));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(almacenComprobantes, never()).guardar(anyLong(), any());
        assertThat(pagoRepository.findByOrdenId(ordenId)).isEmpty();
    }

    @Test
    @DisplayName("S3: el CAJERO puede subir la captura de cualquier orden abierta; MOZO recibe 403; orden cerrada 409")
    void cajeroSubeMozoNoOrdenCerradaNo() throws Exception {
        long abierta = 980012L;
        when(ordenesClient.obtener(abierta)).thenReturn(orden(abierta, CLIENTE_ID, "PENDIENTE_PAGO"));
        when(almacenComprobantes.guardar(eq(abierta), any())).thenReturn("comprobantes/yape/980012/980012-x.png");
        assertThat(subir(abierta, token("CAJERO", 5L)).getStatusCode()).isEqualTo(HttpStatus.OK);
        pagoRepository.findByOrdenId(abierta).ifPresent(p -> pagosCreados.add(p.getId()));

        assertThat(subir(abierta, token("MOZO", 6L)).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        long cerrada = 980013L;
        when(ordenesClient.obtener(cerrada)).thenReturn(orden(cerrada, CLIENTE_ID, "CANCELADO"));
        assertThat(subir(cerrada, token("CAJERO", 5L)).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(pagoRepository.findByOrdenId(cerrada)).isEmpty();
    }

    @Test
    @DisplayName("S3: si orders-service no responde la subida falla cerrada con 503 y no guarda el archivo")
    void subidaFallaCerradaSiOrdersCae() {
        long ordenId = 980014L;
        when(ordenesClient.obtener(ordenId)).thenThrow(new OrdenesClient.OrdenNoDisponibleException("caido", null));

        ResponseEntity<String> resp = subir(ordenId, token("CLIENTE", CLIENTE_ID));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        verify(almacenComprobantes, never()).guardar(anyLong(), any());
    }

    @Test
    @DisplayName("S3: un archivo inválido (rechazado por el almacén) responde 400 y no crea pago")
    void archivoInvalidoResponde400() {
        long ordenId = 980015L;
        when(ordenesClient.obtener(ordenId)).thenReturn(orden(ordenId, CLIENTE_ID, "PENDIENTE_PAGO"));
        when(almacenComprobantes.guardar(eq(ordenId), any()))
                .thenThrow(new IllegalArgumentException("La captura debe ser una imagen JPG, PNG o WEBP"));

        ResponseEntity<String> resp = subir(ordenId, token("CLIENTE", CLIENTE_ID));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).contains("imagen");
        assertThat(pagoRepository.findByOrdenId(ordenId)).isEmpty();
    }

    // ─── Cash collection guard (S6) ────────────────────────────────

    @Test
    @DisplayName("S6: POST /pagos/cobro-efectivo responde 409 si la orden no está en puerta/en camino y no toca la orden")
    void cobroEfectivoRechazadoSiLaOrdenNoEstaEnEntrega() {
        long ordenId = 980020L;
        when(ordenesClient.obtener(ordenId)).thenReturn(new OrdenesClient.OrdenInfo(
                ordenId, "PREPARANDO", "DELIVERY", new BigDecimal("30.00"), CLIENTE_ID, LocalDateTime.now()));

        ResponseEntity<String> resp = cobrar(ordenId, token("REPARTIDOR", 9L));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(pagoRepository.findByOrdenId(ordenId)).isEmpty();
        verify(notificadorOrden, never()).notificarEstado(anyLong(), any(), any());
    }

    @Test
    @DisplayName("S6: POST /pagos/cobro-efectivo con la orden EN_PUERTA aprueba el cobro y marca ENTREGADO")
    void cobroEfectivoPermitidoEnPuerta() {
        long ordenId = 980021L;
        when(ordenesClient.obtener(ordenId)).thenReturn(new OrdenesClient.OrdenInfo(
                ordenId, "EN_PUERTA", "DELIVERY", new BigDecimal("30.00"), CLIENTE_ID, LocalDateTime.now()));

        ResponseEntity<String> resp = cobrar(ordenId, token("REPARTIDOR", 9L));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        pagoRepository.findByOrdenId(ordenId).ifPresent(p -> pagosCreados.add(p.getId()));
        verify(notificadorOrden).notificarEstado(eq(ordenId), eq("ENTREGADO"), any());
    }

    @Test
    @DisplayName("S6: POST /pagos/cobro-efectivo falla cerrado con 503 si orders-service no responde")
    void cobroEfectivoFallaCerrado() {
        long ordenId = 980022L;
        when(ordenesClient.obtener(ordenId)).thenThrow(new OrdenesClient.OrdenNoDisponibleException("caido", null));

        ResponseEntity<String> resp = cobrar(ordenId, token("CAJERO", 5L));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(pagoRepository.findByOrdenId(ordenId)).isEmpty();
    }

    // ─── util ──────────────────────────────────────────────────────

    private OrdenesClient.OrdenInfo orden(long id, long clienteId, String estado) {
        return new OrdenesClient.OrdenInfo(
                id, estado, "DELIVERY", new BigDecimal("45.50"), clienteId, LocalDateTime.now());
    }

    private long crearPago(long ordenId, EstadoPago estado, String clave) {
        Pago pago = new Pago();
        pago.setOrdenId(ordenId);
        pago.setClienteId(CLIENTE_ID);
        pago.setMonto(new BigDecimal("45.50"));
        pago.setMetodoPago(MetodoPago.YAPE_PLIN);
        pago.setEstado(estado);
        pago.setComprobanteClave(clave);
        long id = pagoRepository.saveAndFlush(pago).getId();
        pagosCreados.add(id);
        return id;
    }

    private ResponseEntity<String> get(String ruta, String bearer) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        return rest.exchange(ruta, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private ResponseEntity<String> subir(long ordenId, String bearer) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> cuerpo = new LinkedMultiValueMap<>();
        HttpHeaders parte = new HttpHeaders();
        parte.setContentType(MediaType.IMAGE_JPEG);
        byte[] jpeg = new byte[] {
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0};
        cuerpo.add("file", new HttpEntity<>(new ByteArrayResource(jpeg) {
            @Override
            public String getFilename() {
                return "captura.jpg";
            }
        }, parte));
        return rest.exchange("/pagos/orden/" + ordenId + "/comprobante", HttpMethod.POST,
                new HttpEntity<>(cuerpo, headers), String.class);
    }

    private ResponseEntity<String> cobrar(long ordenId, String bearer) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearer);
        headers.setContentType(MediaType.APPLICATION_JSON);
        String json = "{\"ordenId\": " + ordenId + ", \"monto\": 30.00}";
        return rest.exchange("/pagos/cobro-efectivo", HttpMethod.POST, new HttpEntity<>(json, headers), String.class);
    }

    private String token(String rol, long userId) {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(rol.toLowerCase() + "@prueba.local")
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }
}
