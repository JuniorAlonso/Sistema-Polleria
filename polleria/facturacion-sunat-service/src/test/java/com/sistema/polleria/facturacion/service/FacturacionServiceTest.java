package com.sistema.polleria.facturacion.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.facturacion.dto.EnvioResponse;
import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;
import com.sistema.polleria.facturacion.repository.EnvioSunatRepository;
import com.sistema.polleria.facturacion.sunat.Certificado;
import com.sistema.polleria.facturacion.sunat.ClienteSunat;
import com.sistema.polleria.facturacion.sunat.DocumentoVenta;
import com.sistema.polleria.facturacion.sunat.Emisor;
import com.sistema.polleria.facturacion.sunat.FirmadorXml;
import com.sistema.polleria.facturacion.sunat.Zip;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FacturacionServiceTest {

    @Mock
    private ServiciosInternos servicios;
    @Mock
    private EnvioSunatRepository repositorio;
    @Mock
    private ClienteSunat clienteSunat;
    @Mock
    private JdbcTemplate jdbc;
    @Mock
    private PlatformTransactionManager txManager;

    private FacturacionService service;
    private Emisor emisor;

    @BeforeEach
    void setUp() throws Exception {
        emisor = new Emisor("20608945123", "POLLERIA SAN POLLO DE ICA S.A.C.",
                "POLLERIA SAN POLLO DE ICA", "AV. SAN MARTIN 456", "110101", "ICA", "ICA", "ICA");

        Certificado cert;
        try (InputStream p12 = getClass().getResourceAsStream("/certificado-prueba.p12")) {
            cert = Certificado.desde(p12, "prueba123");
        }
        FirmadorXml firmador = new FirmadorXml(cert, FirmadorXml.Algoritmo.SHA1);

        lenient().when(txManager.getTransaction(any())).thenAnswer(inv -> new SimpleTransactionStatus());
        lenient().doNothing().when(txManager).commit(any(TransactionStatus.class));

        service = new FacturacionService(
                servicios, repositorio, emisor, () -> firmador, clienteSunat,
                jdbc, new ObjectMapper(), txManager);
    }

    @Test
    void rechazaOrdenIdNoPositivo() {
        assertThrows(IllegalArgumentException.class, () -> service.enviar(0L, "Bearer tok"));
        assertThrows(IllegalArgumentException.class, () -> service.enviar(-5L, "Bearer tok"));
        assertThrows(IllegalArgumentException.class, () -> service.obtener(null));
        verifyNoInteractions(repositorio, servicios, clienteSunat);
    }

    @Test
    void devuelveRespuestaGuardadaSiYaFueAceptadoSinLlamarASunat() {
        EnvioSunat aceptado = EnvioSunat.builder()
                .id(10L).ordenId(77L).comprobanteId(5L).tipo("BOLETA")
                .serieNumero("B001-1").nombreArchivo("20608945123-03-B001-1")
                .estado(EstadoSunat.ACEPTADO).codigoRespuesta("0")
                .descripcion("Aceptada").total(new BigDecimal("47.20"))
                .intentos(1).enviadoEn(LocalDateTime.now(FacturacionService.ZONA_LIMA))
                .build();
        when(repositorio.findByOrdenId(77L)).thenReturn(Optional.of(aceptado));

        EnvioResponse res = service.enviar(77L, "Bearer tok");

        assertEquals(EstadoSunat.ACEPTADO, res.estado());
        verifyNoInteractions(servicios, clienteSunat);
    }

    @Test
    void rechazaSiComprobanteEstaAnulado() {
        when(repositorio.findByOrdenId(88L)).thenReturn(Optional.empty());
        when(servicios.comprobanteDeOrden(88L, "Bearer tok")).thenReturn(
                new ServiciosInternos.Comprobante(9L, 88L, "BOLETA", "B001-000009",
                        "DNI", "12345678", "Cliente", null, new BigDecimal("23.60"),
                        LocalDateTime.now(FacturacionService.ZONA_LIMA), true));

        assertThrows(IllegalStateException.class, () -> service.enviar(88L, "Bearer tok"));
        verifyNoInteractions(clienteSunat);
    }

    @Test
    void ejecutaEnvioEnDosTransaccionesYGuardaCdrAceptado() {
        mockOrdenYComprobante(99L);

        AtomicReference<EnvioSunat> guardado = new AtomicReference<>();
        when(repositorio.findByOrdenId(99L)).thenReturn(Optional.empty(), Optional.empty());
        when(repositorio.save(any(EnvioSunat.class))).thenAnswer(inv -> {
            EnvioSunat e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(50L);
            }
            guardado.set(e);
            return e;
        });
        when(repositorio.findById(50L)).thenAnswer(inv -> Optional.ofNullable(guardado.get()));

        String cdrXml = "<?xml version=\"1.0\"?><ar:ApplicationResponse"
                + " xmlns:ar=\"urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2\""
                + " xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\""
                + " xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">"
                + "<cac:DocumentResponse><cac:Response><cbc:ResponseCode>0</cbc:ResponseCode>"
                + "<cbc:Description>La Boleta numero B001-99, ha sido aceptada</cbc:Description>"
                + "</cac:Response></cac:DocumentResponse></ar:ApplicationResponse>";
        byte[] cdrZip = Zip.comprimir("R-20608945123-03-B001-99.xml", cdrXml.getBytes(StandardCharsets.UTF_8));
        when(clienteSunat.enviarFactura(eq("20608945123-03-B001-99.zip"), any(byte[].class)))
                .thenReturn(new ClienteSunat.Respuesta(cdrZip, null, null));

        EnvioResponse res = service.enviar(99L, "Bearer tok");

        assertEquals(EstadoSunat.ACEPTADO, res.estado());
        assertEquals("0", res.codigoRespuesta());
        assertTrue(res.tieneCdr());
        verify(txManager, times(2)).getTransaction(any());
        verify(txManager, times(2)).commit(any());
    }

    @Test
    void bloqueaConcurrenciaCuandoHayEnvioEnCursoReciente() {
        mockOrdenYComprobante(101L);
        EnvioSunat enCurso = EnvioSunat.builder()
                .id(60L).ordenId(101L).estado(EstadoSunat.ENVIANDO)
                .enviadoEn(LocalDateTime.now(FacturacionService.ZONA_LIMA).minusSeconds(15))
                .build();
        when(repositorio.findByOrdenId(101L)).thenReturn(Optional.empty(), Optional.of(enCurso));

        assertThrows(IllegalStateException.class, () -> service.enviar(101L, "Bearer tok"));
        verifyNoInteractions(clienteSunat);
    }

    @Test
    void guardaEstadoErrorSiSunatNoEstaDisponibleYPermiteReintentoPosterior() {
        mockOrdenYComprobante(102L);
        AtomicReference<EnvioSunat> guardado = new AtomicReference<>();
        EnvioSunat expirado = EnvioSunat.builder()
                .id(61L).ordenId(102L).estado(EstadoSunat.ENVIANDO)
                .enviadoEn(LocalDateTime.now(FacturacionService.ZONA_LIMA).minusMinutes(5))
                .intentos(1)
                .build();
        when(repositorio.findByOrdenId(102L)).thenReturn(Optional.empty(), Optional.of(expirado));
        when(repositorio.save(any(EnvioSunat.class))).thenAnswer(inv -> {
            EnvioSunat e = inv.getArgument(0);
            guardado.set(e);
            return e;
        });
        when(repositorio.findById(61L)).thenAnswer(inv -> Optional.ofNullable(guardado.get()));
        when(clienteSunat.enviarFactura(anyString(), any(byte[].class)))
                .thenThrow(new IllegalStateException("Error inesperado de red"));

        EnvioResponse res = service.enviar(102L, "Bearer tok");

        assertEquals(EstadoSunat.ERROR, res.estado());
        assertEquals("Error inesperado de red", res.descripcion());
        assertEquals(2, res.intentos());
    }

    @Test
    void noSobrescribeEnvioYaAceptadoSiUnaRespuestaTardiaLlegaEnTx2() {
        mockOrdenYComprobante(103L);
        EnvioSunat yaAceptadoEnOtraCarrera = EnvioSunat.builder()
                .id(62L).ordenId(103L).comprobanteId(5L).tipo("BOLETA")
                .serieNumero("B001-103").nombreArchivo("20608945123-03-B001-103")
                .estado(EstadoSunat.ACEPTADO).codigoRespuesta("0")
                .descripcion("Aceptada previamente")
                .cdrZip(new byte[]{1, 2, 3})
                .intentos(2)
                .build();

        when(repositorio.findByOrdenId(103L)).thenReturn(Optional.empty(), Optional.empty());
        when(repositorio.save(any(EnvioSunat.class))).thenAnswer(inv -> {
            EnvioSunat e = inv.getArgument(0);
            e.setId(62L);
            return e;
        });
        when(repositorio.findById(62L)).thenReturn(Optional.of(yaAceptadoEnOtraCarrera));
        when(clienteSunat.enviarFactura(anyString(), any(byte[].class)))
                .thenThrow(new ClienteSunat.SunatNoDisponibleException("Timeout tardío", null));

        EnvioResponse res = service.enviar(103L, "Bearer tok");

        assertEquals(EstadoSunat.ACEPTADO, res.estado());
        assertTrue(res.tieneCdr());
        verify(repositorio, times(1)).save(any(EnvioSunat.class));
    }

    @Test
    void preservaCdrSiElXmlDelCdrEsIlegibleYLoMarcaComoError() {
        mockOrdenYComprobante(104L);
        AtomicReference<EnvioSunat> guardado = new AtomicReference<>();
        when(repositorio.findByOrdenId(104L)).thenReturn(Optional.empty(), Optional.empty());
        when(repositorio.save(any(EnvioSunat.class))).thenAnswer(inv -> {
            EnvioSunat e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(63L);
            }
            guardado.set(e);
            return e;
        });
        when(repositorio.findById(63L)).thenAnswer(inv -> Optional.ofNullable(guardado.get()));
        byte[] cdrCorrupto = Zip.comprimir("R-bad.xml", "<no-es-cdr/>".getBytes(StandardCharsets.UTF_8));
        when(clienteSunat.enviarFactura(anyString(), any(byte[].class)))
                .thenReturn(new ClienteSunat.Respuesta(cdrCorrupto, null, null));

        EnvioResponse res = service.enviar(104L, "Bearer tok");

        assertEquals(EstadoSunat.ERROR, res.estado());
        assertTrue(res.tieneCdr());
        assertTrue(res.descripcion().contains("CDR recibido pero ilegible"));
    }

    @Test
    void validaCatalogo06EnBoletasSinDocumentoCerosYTope700() {
        var sinDoc = new ServiciosInternos.Comprobante(1L, 1L, "BOLETA", "B001-000001",
                null, "00000000", "CLIENTES VARIOS", null, new BigDecimal("50.00"),
                LocalDateTime.now(FacturacionService.ZONA_LIMA), false);
        DocumentoVenta.Cliente cli = FacturacionService.cliente(DocumentoVenta.TipoDocumento.BOLETA, sinDoc);
        assertEquals("-", cli.tipoDocumento());
        assertEquals("-", cli.numeroDocumento());

        var boletaAltaSinDni = new ServiciosInternos.Comprobante(2L, 2L, "BOLETA", "B001-000002",
                null, "00000000", "CLIENTES VARIOS", null, new BigDecimal("750.00"),
                LocalDateTime.now(FacturacionService.ZONA_LIMA), false);
        assertThrows(IllegalStateException.class,
                () -> FacturacionService.cliente(DocumentoVenta.TipoDocumento.BOLETA, boletaAltaSinDni));

        var serieCruzada = new ServiciosInternos.Comprobante(3L, 3L, "FACTURA", "B001-000003",
                "RUC", "20123456789", "Empresa SAC", null, new BigDecimal("50.00"),
                LocalDateTime.now(FacturacionService.ZONA_LIMA), false);
        var orden = new ServiciosInternos.Orden(3L, new BigDecimal("50.00"), List.of(
                new ServiciosInternos.Item(1L, "Pollo", 1, new BigDecimal("50.00"))));
        assertThrows(IllegalStateException.class, () -> service.armarDocumento(serieCruzada, orden));
    }

    private void mockOrdenYComprobante(long ordenId) {
        when(servicios.comprobanteDeOrden(ordenId, "Bearer tok")).thenReturn(
                new ServiciosInternos.Comprobante(5L, ordenId, "BOLETA", "B001-0000" + ordenId,
                        "DNI", "12345678", "Ana Pérez", "Ica", new BigDecimal("23.60"),
                        LocalDateTime.now(FacturacionService.ZONA_LIMA), false));
        when(servicios.orden(ordenId, "Bearer tok")).thenReturn(
                new ServiciosInternos.Orden(ordenId, new BigDecimal("23.60"), List.of(
                        new ServiciosInternos.Item(1L, "1/4 Pollo", 1, new BigDecimal("23.60"))
                )));
    }
}
