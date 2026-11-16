package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.config.SecurityConfig;
import com.sistema.polleria.orders.dto.ProductoResponse;
import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.filter.JwtAuthFilter;
import com.sistema.polleria.orders.service.ProductoService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pruebas de autorización de {@code PATCH /productos/{id}/disponibilidad} pasando por la cadena
 * real de seguridad ({@link SecurityConfig}, {@link JwtAuthFilter} y {@code @EnableMethodSecurity}).
 *
 * Verifica que únicamente {@code COCINA} y {@code ADMIN} pueden alternar la disponibilidad de un
 * plato, que {@code MOZO}, {@code CAJERO}, {@code REPARTIDOR}, {@code CLIENTE} y peticiones
 * anónimas reciben {@code 403 Forbidden}, y que los demás endpoints de administración de productos
 * permanecen restringidos exclusivamente a {@code ADMIN}.
 */
@WebMvcTest(controllers = {ProductoController.class, GlobalExceptionHandler.class})
@Import({SecurityConfig.class, JwtAuthFilter.class})
@ActiveProfiles("test")
class ProductoDisponibilidadSecurityTest {

    private static final String SECRETO = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductoService productoService;

    @MockBean
    private com.sistema.polleria.orders.service.MinioProductoService minioProductoService;

    @AfterEach
    void limpiarContextoSeguridad() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cocinaPuedeAlternarDisponibilidadConTokenJwtReal() throws Exception {
        when(productoService.toggleDisponibilidad(10L)).thenReturn(productoRespuesta(10L, false));

        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(501L, "COCINA")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.disponible").value(false));

        verify(productoService, times(1)).toggleDisponibilidad(10L);
    }

    @Test
    void adminPuedeAlternarDisponibilidadConTokenJwtReal() throws Exception {
        when(productoService.toggleDisponibilidad(10L)).thenReturn(productoRespuesta(10L, true));

        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(502L, "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.disponible").value(true));

        verify(productoService, times(1)).toggleDisponibilidad(10L);
    }

    @Test
    void reconoceCadaAutoridadPermitidaIndividualmente() throws Exception {
        when(productoService.toggleDisponibilidad(10L)).thenReturn(productoRespuesta(10L, false));

        for (String rol : List.of("ADMIN", "COCINA")) {
            mockMvc.perform(patch("/productos/10/disponibilidad")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(600L, rol)))
                    .andExpect(status().isOk());
        }

        verify(productoService, times(2)).toggleDisponibilidad(10L);
    }

    @Test
    void mozoRecibe403AlIntentarAlternarDisponibilidad() throws Exception {
        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(503L, "MOZO")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verify(productoService, never()).toggleDisponibilidad(anyLong());
    }

    @Test
    void cajeroRecibe403AlIntentarAlternarDisponibilidad() throws Exception {
        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(504L, "CAJERO")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verify(productoService, never()).toggleDisponibilidad(anyLong());
    }

    @Test
    void repartidorRecibe403AlIntentarAlternarDisponibilidad() throws Exception {
        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(505L, "REPARTIDOR")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verify(productoService, never()).toggleDisponibilidad(anyLong());
    }

    @Test
    void clienteYAnonimoReciben403AlIntentarAlternarDisponibilidad() throws Exception {
        mockMvc.perform(patch("/productos/10/disponibilidad")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenDe(506L, "CLIENTE")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        mockMvc.perform(patch("/productos/10/disponibilidad"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        verify(productoService, never()).toggleDisponibilidad(anyLong());
    }

    @Test
    void demasEndpointsDeAdministracionDeProductosPermanecenRestringidosAAdmin() throws Exception {
        String jsonProducto = """
                {
                  "nombre": "1/4 de Pollo a la Brasa",
                  "descripcion": "Con papas y ensalada",
                  "precio": 22.50,
                  "categoria": "POLLO_ENTERO",
                  "disponible": true,
                  "stock": 15
                }
                """;
        String jsonStock = """
                {
                  "stock": 20
                }
                """;

        // COCINA, MOZO, CAJERO y REPARTIDOR reciben 403 en crear, actualizar, stock y eliminar
        for (String rol : List.of("COCINA", "MOZO", "CAJERO", "REPARTIDOR")) {
            String bearer = "Bearer " + tokenDe(700L, rol);

            mockMvc.perform(post("/productos")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(jsonProducto))
                    .andExpect(status().isForbidden());

            mockMvc.perform(put("/productos/10")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(jsonProducto))
                    .andExpect(status().isForbidden());

            mockMvc.perform(patch("/productos/10/stock")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(jsonStock))
                    .andExpect(status().isForbidden());

            mockMvc.perform(delete("/productos/10")
                            .header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isForbidden());
        }

        verify(productoService, never()).crear(any());
        verify(productoService, never()).actualizar(anyLong(), any());
        verify(productoService, never()).actualizarStock(anyLong(), anyInt());
        verify(productoService, never()).eliminar(anyLong());

        // ADMIN conserva acceso completo a todos los endpoints de administración
        reset(productoService);
        when(productoService.crear(any())).thenReturn(productoRespuesta(11L, true));
        when(productoService.actualizar(eq(10L), any())).thenReturn(productoRespuesta(10L, true));
        when(productoService.actualizarStock(10L, 20)).thenReturn(productoRespuesta(10L, true));

        String bearerAdmin = "Bearer " + tokenDe(701L, "ADMIN");

        mockMvc.perform(post("/productos")
                        .header(HttpHeaders.AUTHORIZATION, bearerAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonProducto))
                .andExpect(status().isCreated());

        mockMvc.perform(put("/productos/10")
                        .header(HttpHeaders.AUTHORIZATION, bearerAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonProducto))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/productos/10/stock")
                        .header(HttpHeaders.AUTHORIZATION, bearerAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonStock))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/productos/10")
                        .header(HttpHeaders.AUTHORIZATION, bearerAdmin))
                .andExpect(status().isNoContent());

        verify(productoService, times(1)).crear(any());
        verify(productoService, times(1)).actualizar(eq(10L), any());
        verify(productoService, times(1)).actualizarStock(10L, 20);
        verify(productoService, times(1)).eliminar(10L);
    }

    private ProductoResponse productoRespuesta(Long id, boolean disponible) {
        return ProductoResponse.builder()
                .id(id)
                .nombre("Pollo a la Brasa")
                .categoria(Categoria.POLLO_ENTERO)
                .precio(new BigDecimal("60.00"))
                .disponible(disponible)
                .stock(10)
                .build();
    }

    private String tokenDe(long userId, String rol) {
        SecretKey clave = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject("usuario" + userId + "@prueba.local")
                .claim("role", rol)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3_600_000))
                .signWith(clave)
                .compact();
    }
}

