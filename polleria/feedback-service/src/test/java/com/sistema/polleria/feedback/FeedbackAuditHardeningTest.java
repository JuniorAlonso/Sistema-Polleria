package com.sistema.polleria.feedback;

import com.sistema.polleria.feedback.config.MinioConfig;
import com.sistema.polleria.feedback.config.SecurityConfig;
import com.sistema.polleria.feedback.controller.GlobalExceptionHandler;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.dto.ResolverReporteRequest;
import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import com.sistema.polleria.feedback.entity.Resenia;
import com.sistema.polleria.feedback.filter.JwtAuthFilter;
import com.sistema.polleria.feedback.repository.ReporteIncidenciaRepository;
import com.sistema.polleria.feedback.repository.ReseniaRepository;
import com.sistema.polleria.feedback.service.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class FeedbackAuditHardeningTest {

    private static final String SECRET = "sanpollo-dev-secret-key-2026-super-segura-256bits-minimo";

    @AfterEach
    void limpiarContextoSeguridad() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void minioFallaCerradoSiFaltanCredenciales() {
        MinioConfig cfg = new MinioConfig();
        ReflectionTestUtils.setField(cfg, "endpoint", "");
        ReflectionTestUtils.setField(cfg, "accessKey", "");
        ReflectionTestUtils.setField(cfg, "secretKey", "");
        ReflectionTestUtils.setField(cfg, "port", 9000);
        ReflectionTestUtils.setField(cfg, "useSsl", false);

        assertThrows(IllegalStateException.class, cfg::minioClient);
    }

    @Test
    @SuppressWarnings("unchecked")
    void corsExcluyeLoopbackCuandoFlagEstaDesactivado() throws Exception {
        Method m = SecurityConfig.class.getDeclaredMethod("origenesPermitidos", String.class, boolean.class);
        m.setAccessible(true);
        List<String> origenes = (List<String>) m.invoke(null, "https://polleria.example", false);
        assertEquals(List.of("https://polleria.example"), origenes);
    }

    @Test
    void jwtFilterIgnoraTokenDeSeguimiento() throws Exception {
        String token = Jwts.builder()
                .subject("999000111")
                .claim("tipo", "seguimiento")
                .claim("role", "ADMIN")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        JwtAuthFilter filter = new JwtAuthFilter();
        ReflectionTestUtils.setField(filter, "secret", SECRET);

        MockHttpServletRequest req = new MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(req, res, chain);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void reseniasPorOrdenOcultanNoVisiblesYClienteIdParaPublico() {
        ReseniaRepository repo = mock(ReseniaRepository.class);
        OrdersClient orders = mock(OrdersClient.class);
        ReseniaService service = new ReseniaService(repo, orders);

        Resenia visible = Resenia.builder().id(1L).ordenId(10L).clienteId(50L).calificacion(5).visible(true).build();
        Resenia oculta = Resenia.builder().id(2L).ordenId(10L).clienteId(60L).calificacion(1).visible(false).build();
        when(repo.findByOrdenId(10L)).thenReturn(List.of(visible, oculta));

        List<ReseniaResponse> publico = service.listarPorOrden(10L, null, false);
        assertEquals(1, publico.size());
        assertNull(publico.get(0).getClienteId());

        List<ReseniaResponse> duenoOculta = service.listarPorOrden(10L, 60L, false);
        assertEquals(2, duenoOculta.size());
        assertEquals(60L, duenoOculta.get(1).getClienteId());
        assertNull(duenoOculta.get(0).getClienteId());

        List<ReseniaResponse> admin = service.listarPorOrden(10L, 1L, true);
        assertEquals(2, admin.size());
        assertEquals(50L, admin.get(0).getClienteId());
    }

    @Test
    void globalExceptionHandlerMapeaConcurrenciaEIntegridadAConflict409() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        assertEquals(HttpStatus.CONFLICT,
                handler.handleConcurrencyConflict(new OptimisticLockingFailureException("stale")).getStatusCode());
        assertEquals(HttpStatus.CONFLICT,
                handler.handleDataIntegrity(new DataIntegrityViolationException("dup")).getStatusCode());
    }

    @Test
    void cambiarEstadoRechazaSalirDeEstadoTerminal() {
        ReporteIncidenciaRepository repo = mock(ReporteIncidenciaRepository.class);
        ReporteIncidenciaService service = new ReporteIncidenciaService(
                repo, mock(FileStorageService.class), mock(PaymentsClient.class), mock(OrdersClient.class), mock(FinanceClient.class));

        ReporteIncidencia resuelto = ReporteIncidencia.builder()
                .id(1L).ordenId(10L).clienteId(5L).estado(EstadoReclamo.RESUELTO).build();
        when(repo.buscarConBloqueo(1L)).thenReturn(Optional.of(resuelto));

        assertThrows(IllegalStateException.class, () -> service.cambiarEstado(1L, EstadoReclamo.ABIERTO));
    }

    @Test
    void resolverRechazaMontoMayorQueElTotalDeLaOrden() {
        ReporteIncidenciaRepository repo = mock(ReporteIncidenciaRepository.class);
        OrdersClient orders = mock(OrdersClient.class);
        PaymentsClient payments = mock(PaymentsClient.class);
        ReporteIncidenciaService service = new ReporteIncidenciaService(
                repo, mock(FileStorageService.class), payments, orders, mock(FinanceClient.class));

        ReporteIncidencia abierto = ReporteIncidencia.builder()
                .id(1L).ordenId(10L).clienteId(5L).motivo(MotivoReclamo.PEDIDO_INCOMPLETO)
                .estado(EstadoReclamo.ABIERTO).build();
        when(repo.findById(1L)).thenReturn(Optional.of(abierto));
        when(orders.obtenerYValidarOrden(10L, null, true)).thenReturn(Map.of("id", 10L, "total", 45.00));

        ResolverReporteRequest req = ResolverReporteRequest.builder()
                .estado(EstadoReclamo.RESUELTO)
                .respuestaAdmin("Reembolso")
                .reembolsoProcedente(true)
                .montoReembolso(new BigDecimal("100.00"))
                .build();

        assertThrows(IllegalArgumentException.class, () -> service.resolver(1L, req, "Bearer tok"));
        verify(payments, never()).emitirReembolsoPorOrden(anyLong(), anyLong(), any(), any(), any());
    }

    @Test
    void resolverEjecutaLlamadaRemotaFueraDeTransaccion() {
        ReporteIncidenciaRepository repo = mock(ReporteIncidenciaRepository.class);
        OrdersClient orders = mock(OrdersClient.class);
        PaymentsClient payments = mock(PaymentsClient.class);
        ReporteIncidenciaService service = new ReporteIncidenciaService(
                repo, mock(FileStorageService.class), payments, orders, mock(FinanceClient.class));

        AtomicBoolean enTransaccion = new AtomicBoolean(false);
        PlatformTransactionManager txMgr = new PlatformTransactionManager() {
            @Override
            public org.springframework.transaction.TransactionStatus getTransaction(TransactionDefinition def) {
                enTransaccion.set(true);
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(org.springframework.transaction.TransactionStatus status) {
                enTransaccion.set(false);
            }

            @Override
            public void rollback(org.springframework.transaction.TransactionStatus status) {
                enTransaccion.set(false);
            }
        };
        ReflectionTestUtils.setField(service, "transactionManager", txMgr);

        ReporteIncidencia abierto = ReporteIncidencia.builder()
                .id(1L).ordenId(10L).clienteId(5L).motivo(MotivoReclamo.PEDIDO_INCOMPLETO)
                .estado(EstadoReclamo.ABIERTO).reembolsoEnProceso(false).build();
        when(repo.findById(1L)).thenReturn(Optional.of(abierto));
        when(repo.buscarConBloqueo(1L)).thenReturn(Optional.of(abierto));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orders.obtenerYValidarOrden(10L, null, true)).thenReturn(Map.of("id", 10L, "total", 50.00));
        when(payments.emitirReembolsoPorOrden(anyLong(), anyLong(), any(), any(), any())).thenAnswer(inv -> {
            assertFalse(enTransaccion.get(), "PaymentsClient no debe invocarse con transacción BD abierta");
            return "MERCADOPAGO";
        });

        ResolverReporteRequest req = ResolverReporteRequest.builder()
                .estado(EstadoReclamo.RESUELTO)
                .respuestaAdmin("Procede")
                .reembolsoProcedente(true)
                .montoReembolso(new BigDecimal("25.00"))
                .build();

        var resp = service.resolver(1L, req, "Bearer tok");
        assertEquals("MERCADOPAGO", resp.getCanalDevolucion());
        assertEquals(EstadoReclamo.RESUELTO, resp.getEstado());
    }
}
