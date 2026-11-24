package com.sistema.polleria.facturacion.controller;

import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;
import com.sistema.polleria.facturacion.service.CertificadoSunatException;
import com.sistema.polleria.facturacion.service.FacturacionService;
import com.sistema.polleria.facturacion.service.TicketService;
import com.sistema.polleria.facturacion.sunat.DocumentoVenta;
import com.sistema.polleria.facturacion.sunat.Emisor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceAndControllerTest {

    @Mock
    private FacturacionService facturacionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        Emisor emisor = new Emisor("20608945123", "POLLERIA SAN POLLO DE ICA S.A.C.",
                "POLLERIA SAN POLLO DE ICA", "AV. SAN MARTIN 456", "110101", "ICA", "ICA", "ICA");
        TicketService ticketService = new TicketService(emisor);
        FacturacionController controller = new FacturacionController(facturacionService, ticketService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void ticketAceptadoDevuelveHtmlConCspYQrYEscapaComillasSimples() throws Exception {
        EnvioSunat envio = EnvioSunat.builder()
                .ordenId(77L)
                .tipo("BOLETA")
                .serieNumero("B001-77")
                .estado(EstadoSunat.ACEPTADO)
                .clienteTipoDoc("1")
                .clienteNumDoc("12345678")
                .clienteNombre("O'Connor <Test>")
                .totalValorVenta(new BigDecimal("40.00"))
                .totalIgv(new BigDecimal("7.20"))
                .total(new BigDecimal("47.20"))
                .hash("hash123==")
                .fechaEmision(LocalDateTime.of(2026, 11, 23, 20, 30))
                .build();
        List<DocumentoVenta.Linea> lineas = List.of(
                new DocumentoVenta.Linea("P1", "1/4 Pollo", BigDecimal.ONE,
                        new BigDecimal("40.00"), new BigDecimal("47.20"),
                        new BigDecimal("40.00"), new BigDecimal("7.20"))
        );
        when(facturacionService.obtener(77L)).thenReturn(envio);
        when(facturacionService.lineas(envio)).thenReturn(lineas);

        mockMvc.perform(get("/facturacion/orden/77/ticket").accept(MediaType.TEXT_HTML, MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'none'")))
                .andExpect(content().string(containsString("http-equiv=\"Content-Security-Policy\"")))
                .andExpect(content().string(containsString("O&#39;Connor &lt;Test&gt;")))
                .andExpect(content().string(containsString("<svg xmlns=\"http://www.w3.org/2000/svg\"")));
    }

    @Test
    void ticketNoEncontradoDevuelve404JsonEnLugarDe406() throws Exception {
        when(facturacionService.obtener(999L))
                .thenThrow(new NoSuchElementException("La orden #999 aún no se envió a SUNAT"));

        mockMvc.perform(get("/facturacion/orden/999/ticket").accept(MediaType.TEXT_HTML))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value(containsString("999")));
    }

    @Test
    void ticketEnEstadoErrorDevuelve409JsonSinQr() throws Exception {
        EnvioSunat envioError = EnvioSunat.builder()
                .ordenId(55L)
                .estado(EstadoSunat.ERROR)
                .build();
        when(facturacionService.obtener(55L)).thenReturn(envioError);

        mockMvc.perform(get("/facturacion/orden/55/ticket"))
                .andExpect(status().isConflict())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value(containsString("ERROR")));
    }

    @Test
    void parametroEstadoInvalidoDevuelve400YErrorCertificadoNoFiltraRutas() throws Exception {
        mockMvc.perform(get("/facturacion").param("estado", "INVALIDO"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value(containsString("estado")));

        when(facturacionService.enviar(10L, null))
                .thenThrow(new CertificadoSunatException("Fallo leyendo C:/secreto/cert.p12"));

        mockMvc.perform(post("/facturacion/orden/10/enviar"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error").value(not(containsString("C:/"))))
                .andExpect(jsonPath("$.error").value(not(containsString("cert.p12"))));
    }
}
