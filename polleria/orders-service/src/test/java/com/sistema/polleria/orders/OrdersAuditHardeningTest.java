package com.sistema.polleria.orders;

import com.sistema.polleria.orders.config.MinioConfig;
import com.sistema.polleria.orders.config.SecurityConfig;
import com.sistema.polleria.orders.config.WebSocketConfig;
import com.sistema.polleria.orders.dto.OrdenItemRequest;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.exception.ConflictoDeEstadoException;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.service.MesaService;
import com.sistema.polleria.orders.service.NotificationService;
import com.sistema.polleria.orders.service.NumeroPedidoService;
import com.sistema.polleria.orders.service.OrdenService;
import com.sistema.polleria.orders.service.PagosConsultaClient;
import com.sistema.polleria.orders.service.ProductoService;
import com.sistema.polleria.orders.service.SalonEventPublisher;
import com.sistema.polleria.orders.service.SancionDispatcherService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OrdersAuditHardeningTest {

    private static final String SECRET = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    private static String jwtConRol(String role, String tipo) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        var builder = Jwts.builder()
                .subject("user@test.local")
                .claim("userId", 10L)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000));
        if (role != null) {
            builder.claim("role", role);
        }
        if (tipo != null) {
            builder.claim("tipo", tipo);
        }
        return builder.signWith(key).compact();
    }

    @Test
    void corsLoopbackOmitidoEnProduccionCuandoBanderaEsFalsa() {
        List<String> produccion = SecurityConfig.origenesPermitidos("https://sanpollo.example", false);
        assertEquals(List.of("https://sanpollo.example"), produccion);

        List<String> local = SecurityConfig.origenesPermitidos("https://sanpollo.example", true);
        assertTrue(local.contains("http://localhost:[*]"));
        assertTrue(local.contains("http://127.0.0.1:[*]"));
    }

    @Test
    void minioConfigFallaCerradoConCredencialesEnBlanco() {
        MinioConfig cfg = new MinioConfig();
        ReflectionTestUtils.setField(cfg, "endpoint", "   ");
        ReflectionTestUtils.setField(cfg, "accessKey", "minioadmin");
        ReflectionTestUtils.setField(cfg, "secretKey", "minioadmin");
        assertThrows(IllegalStateException.class, cfg::minioClient);
    }

    @Test
    void webSocketRechazaSeguimientoYExigeRolDePersonalEnTopicosInternos() throws Exception {
        var authMethod = WebSocketConfig.class.getDeclaredMethod(
                "autenticarCabeceras", String.class, String.class, String.class, String.class);
        authMethod.setAccessible(true);
        var reqPersonal = WebSocketConfig.class.getDeclaredMethod("requierePersonal", String.class);
        reqPersonal.setAccessible(true);
        var hasStaff = WebSocketConfig.class.getDeclaredMethod("tieneRolPersonal", Authentication.class);
        hasStaff.setAccessible(true);

        assertNull(authMethod.invoke(null, null, null, SECRET, "key"));
        assertNull(authMethod.invoke(null, "Bearer " + jwtConRol(null, "seguimiento"), null, SECRET, "key"));

        Authentication clienteAuth = (Authentication) authMethod.invoke(
                null, "Bearer " + jwtConRol("CLIENTE", null), null, SECRET, "key");
        assertNotNull(clienteAuth);
        assertTrue((boolean) reqPersonal.invoke(null, "/topic/cocina/nuevas-comandas"));
        assertTrue((boolean) reqPersonal.invoke(null, "/topic/salon/mesas"));
        assertFalse((boolean) hasStaff.invoke(null, clienteAuth));

        Authentication mozoAuth = (Authentication) authMethod.invoke(
                null, "Bearer " + jwtConRol("MOZO", null), null, SECRET, "key");
        assertNotNull(mozoAuth);
        assertTrue((boolean) hasStaff.invoke(null, mozoAuth));

        Authentication internalAuth = (Authentication) authMethod.invoke(null, null, "key", SECRET, "key");
        assertNotNull(internalAuth);
        assertTrue((boolean) hasStaff.invoke(null, internalAuth));
    }

    @Test
    void pagosConsultaClientDetectaPagoAprobadoDeOrdenYDegradaSiNoExiste() throws Exception {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

        var ctor = PagosConsultaClient.class.getDeclaredConstructor(RestClient.class, String.class, String.class);
        ctor.setAccessible(true);
        PagosConsultaClient client = ctor.newInstance(builder.build(), "http://payments", "secret-key");

        server.expect(requestTo("http://payments/pagos/orden/42"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-Internal-Key", "secret-key"))
                .andRespond(withSuccess("{\"estado\":\"APROBADO\"}", MediaType.APPLICATION_JSON));
        assertTrue(client.tienePagoAprobado(42L));
        server.verify();
        server.reset();

        server.expect(requestTo("http://payments/pagos/orden/43"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertFalse(client.tienePagoAprobado(43L));
        server.verify();
    }

    @Test
    void agregarItemsBloqueaSiComandaYaTienePagoAprobado() {
        OrdenRepository ordenRepo = mock(OrdenRepository.class);
        OrdenService service = new OrdenService(
                ordenRepo,
                mock(ProductoService.class),
                mock(MesaService.class),
                mock(NotificationService.class),
                mock(SalonEventPublisher.class),
                mock(NumeroPedidoService.class),
                mock(SancionDispatcherService.class));
        PagosConsultaClient pagosClient = mock(PagosConsultaClient.class);
        ReflectionTestUtils.setField(service, "pagosConsultaClient", pagosClient);

        Orden orden = Orden.builder()
                .id(15L)
                .tipo(OrdenTipo.SALON)
                .estado(OrdenEstado.LISTO)
                .items(new ArrayList<>())
                .build();
        when(ordenRepo.buscarConBloqueo(15L)).thenReturn(Optional.of(orden));
        when(pagosClient.tienePagoAprobado(15L)).thenReturn(true);

        OrdenItemRequest item = new OrdenItemRequest();
        item.setProductoId(1L);
        item.setCantidad(1);

        assertThrows(ConflictoDeEstadoException.class,
                () -> service.agregarItems(15L, List.of(item), 10L));
    }

    @Test
    void sancionDispatcherFallaCerradoSiAuthFallaYNoHayCachePrevia() throws Exception {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        var ctor = SancionDispatcherService.class.getDeclaredConstructor(
                RestClient.class, String.class, String.class, String.class);
        ctor.setAccessible(true);
        SancionDispatcherService dispatcher = ctor.newInstance(builder.build(), "http://auth", "http://incident", "key");

        server.expect(requestTo("http://auth/auth/sanciones/verificar?telefono=999000111"))
                .andRespond(withServerError());

        assertTrue(dispatcher.tieneSancionActiva("999000111", null, null));
        server.verify();
    }
}
