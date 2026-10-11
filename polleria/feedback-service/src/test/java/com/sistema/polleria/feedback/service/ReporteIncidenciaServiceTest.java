package com.sistema.polleria.feedback.service;

import com.sistema.polleria.feedback.dto.CrearReporteRequest;
import com.sistema.polleria.feedback.dto.ReporteResponse;
import com.sistema.polleria.feedback.dto.ResolverReporteRequest;
import com.sistema.polleria.feedback.entity.EstadoReclamo;
import com.sistema.polleria.feedback.entity.MotivoReclamo;
import com.sistema.polleria.feedback.entity.ReporteIncidencia;
import com.sistema.polleria.feedback.repository.ReporteIncidenciaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReporteIncidenciaServiceTest {

    @Mock
    private ReporteIncidenciaRepository reporteRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private PaymentsClient paymentsClient;

    @InjectMocks
    private ReporteIncidenciaService reporteService;

    private CrearReporteRequest request;

    @BeforeEach
    void setUp() {
        request = CrearReporteRequest.builder()
                .ordenId(55L)
                .motivo(MotivoReclamo.PEDIDO_INCOMPLETO)
                .descripcion("Faltaron las papas fritas del combo")
                .build();
    }

    @Test
    void testCrearReporteConFoto() {
        MockMultipartFile foto = new MockMultipartFile(
                "foto", "evidencia.jpg", "image/jpeg", "dummy-bytes".getBytes());

        when(fileStorageService.guardarArchivo(foto)).thenReturn("/feedback/evidencias/test.jpg");
        when(reporteRepository.save(any(ReporteIncidencia.class))).thenAnswer(i -> {
            ReporteIncidencia r = i.getArgument(0);
            r.setId(1L);
            return r;
        });

        ReporteResponse response = reporteService.crear(request, foto, 7L);

        assertNotNull(response);
        assertEquals(55L, response.getOrdenId());
        assertEquals(MotivoReclamo.PEDIDO_INCOMPLETO, response.getMotivo());
        assertEquals("/feedback/evidencias/test.jpg", response.getFotoEvidenciaUrl());
        assertEquals(EstadoReclamo.ABIERTO, response.getEstado());
        verify(fileStorageService).guardarArchivo(foto);
    }

    @Test
    void testResolverReporteConReembolso() {
        ReporteIncidencia reporte = ReporteIncidencia.builder()
                .id(1L)
                .ordenId(55L)
                .clienteId(7L)
                .motivo(MotivoReclamo.PEDIDO_INCOMPLETO)
                .descripcion("Faltaron las papas")
                .estado(EstadoReclamo.ABIERTO)
                .build();

        when(reporteRepository.findById(1L)).thenReturn(Optional.of(reporte));
        when(reporteRepository.save(any(ReporteIncidencia.class))).thenReturn(reporte);

        ResolverReporteRequest resolverReq = ResolverReporteRequest.builder()
                .estado(EstadoReclamo.RESUELTO)
                .respuestaAdmin("Reembolso autorizado por las papas faltantes")
                .reembolsoProcedente(true)
                .montoReembolso(new BigDecimal("15.00"))
                .build();

        ReporteResponse response = reporteService.resolver(1L, resolverReq, "Bearer test-token");

        assertEquals(EstadoReclamo.RESUELTO, response.getEstado());
        assertTrue(response.getReembolsoProcedente());
        assertEquals(new BigDecimal("15.00"), response.getMontoReembolso());
        assertNotNull(response.getResueltoEn());

        verify(paymentsClient).emitirReembolsoPorOrden(
                eq(55L), eq(new BigDecimal("15.00")), eq("Reembolso autorizado por las papas faltantes"), eq("Bearer test-token"));
    }

    @Test
    void testResolverReporteSinReembolso() {
        ReporteIncidencia reporte = ReporteIncidencia.builder()
                .id(2L)
                .ordenId(60L)
                .clienteId(7L)
                .motivo(MotivoReclamo.OTRO)
                .descripcion("No me gustó el empaque")
                .estado(EstadoReclamo.ABIERTO)
                .build();

        when(reporteRepository.findById(2L)).thenReturn(Optional.of(reporte));
        when(reporteRepository.save(any(ReporteIncidencia.class))).thenReturn(reporte);

        ResolverReporteRequest resolverReq = ResolverReporteRequest.builder()
                .estado(EstadoReclamo.RECHAZADO)
                .respuestaAdmin("El empaque cumple con la normativa de higiene")
                .reembolsoProcedente(false)
                .build();

        ReporteResponse response = reporteService.resolver(2L, resolverReq, null);

        assertEquals(EstadoReclamo.RECHAZADO, response.getEstado());
        assertFalse(response.getReembolsoProcedente());
        verify(paymentsClient, never()).emitirReembolsoPorOrden(any(), any(), any(), any());
    }
}
