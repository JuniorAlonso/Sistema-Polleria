package com.sistema.polleria.facturacion.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.polleria.facturacion.dto.EnvioResponse;
import com.sistema.polleria.facturacion.entity.EnvioSunat;
import com.sistema.polleria.facturacion.entity.EstadoSunat;
import com.sistema.polleria.facturacion.repository.EnvioSunatRepository;
import com.sistema.polleria.facturacion.sunat.CalculadoraMontos;
import com.sistema.polleria.facturacion.sunat.ClienteSunat;
import com.sistema.polleria.facturacion.sunat.DocumentoVenta;
import com.sistema.polleria.facturacion.sunat.Emisor;
import com.sistema.polleria.facturacion.sunat.FirmadorXml;
import com.sistema.polleria.facturacion.sunat.GeneradorXmlUbl;
import com.sistema.polleria.facturacion.sunat.LectorCdr;
import com.sistema.polleria.facturacion.sunat.Zip;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Orquesta todo el proceso de facturación electrónica de una orden en 2 transacciones cortas
 * para no retener conexiones PostgreSQL durante la llamada SOAP a SUNAT.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FacturacionService {

    private static final long BASE_CANDADO = 5_000_000L;
    private static final BigDecimal TOPE_BOLETA_SIN_DOC = new BigDecimal("700.00");
    private static final Pattern PATRON_SERIE_CORRELATIVO = Pattern.compile("^([FB][A-Z0-9]{3})-(\\d{1,8})$");
    static final ZoneId ZONA_LIMA = ZoneId.of("America/Lima");
    static final Duration TIMEOUT_ENVIANDO = Duration.ofMinutes(2);

    private final ServiciosInternos servicios;
    private final EnvioSunatRepository repositorio;
    private final Emisor emisor;
    private final Supplier<FirmadorXml> firmador;
    private final ClienteSunat clienteSunat;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final PlatformTransactionManager transacciones;

    private record PreparacionEnvio(EnvioResponse respuestaDefinitiva, Long envioId, int intento,
                                    String nombreArchivo, byte[] zipBytes) {
        static PreparacionEnvio yaDefinitivo(EnvioResponse respuesta) {
            return new PreparacionEnvio(respuesta, null, 0, null, null);
        }

        static PreparacionEnvio listoParaEnviar(Long envioId, int intento, String nombreArchivo, byte[] zipBytes) {
            return new PreparacionEnvio(null, envioId, intento, nombreArchivo, zipBytes);
        }
    }

    public EnvioResponse enviar(Long ordenId, String bearer) {
        validarOrdenId(ordenId);

        var existente = repositorio.findByOrdenId(ordenId);
        if (existente.isPresent() && existente.get().getEstado().esDefinitivo()) {
            return EnvioResponse.from(existente.get());
        }

        ServiciosInternos.Comprobante comprobante = servicios.comprobanteDeOrden(ordenId, bearer);
        if (Boolean.TRUE.equals(comprobante.anulado())) {
            throw new IllegalStateException("El comprobante de la orden #" + ordenId
                    + " está anulado; no se envía a SUNAT.");
        }
        ServiciosInternos.Orden orden = servicios.orden(ordenId, bearer);
        DocumentoVenta documento = armarDocumento(comprobante, orden);

        TransactionTemplate tx = new TransactionTemplate(transacciones);
        PreparacionEnvio preparacion = tx.execute(status -> prepararYMarcarEnviando(ordenId, comprobante.id(), documento));
        if (preparacion == null) {
            throw new IllegalStateException("No se pudo iniciar el envío a SUNAT para la orden #" + ordenId);
        }
        if (preparacion.respuestaDefinitiva() != null) {
            return preparacion.respuestaDefinitiva();
        }

        ClienteSunat.Respuesta respuestaSunat = null;
        String errorConexion = null;
        try {
            respuestaSunat = clienteSunat.enviarFactura(preparacion.nombreArchivo() + ".zip", preparacion.zipBytes());
        } catch (RuntimeException e) {
            log.warn("Fallo enviando orden #{} a SUNAT: {}", ordenId, e.getMessage());
            errorConexion = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        }

        final ClienteSunat.Respuesta respuestaFinal = respuestaSunat;
        final String errorFinal = errorConexion;
        return tx.execute(status -> registrarResultadoSunat(
                ordenId, preparacion.envioId(), preparacion.intento(), respuestaFinal, errorFinal));
    }

    private PreparacionEnvio prepararYMarcarEnviando(Long ordenId, Long comprobanteId, DocumentoVenta documento) {
        jdbc.query("SELECT pg_advisory_xact_lock(?)", rs -> null, BASE_CANDADO + ordenId);

        LocalDateTime ahoraLima = LocalDateTime.now(ZONA_LIMA);
        EnvioSunat envio = repositorio.findByOrdenId(ordenId).orElse(null);
        if (envio != null) {
            if (envio.getEstado().esDefinitivo()) {
                return PreparacionEnvio.yaDefinitivo(EnvioResponse.from(envio));
            }
            if (envio.getEstado() == EstadoSunat.ENVIANDO
                    && envio.getEnviadoEn() != null
                    && envio.getEnviadoEn().isAfter(ahoraLima.minus(TIMEOUT_ENVIANDO))) {
                throw new IllegalStateException("El comprobante de la orden #" + ordenId
                        + " ya se está enviando a SUNAT. Intenta nuevamente en unos segundos.");
            }
        } else {
            envio = EnvioSunat.builder().ordenId(ordenId).build();
        }

        String nombre = documento.nombreArchivo(emisor.ruc());
        String xml = GeneradorXmlUbl.generar(emisor, documento);
        FirmadorXml.Resultado firmado = firmador.get().firmar(xml);
        byte[] zip = Zip.comprimir(nombre + ".xml", firmado.xmlFirmado());

        guardarDatos(envio, comprobanteId, documento, nombre, firmado);
        int nuevoIntento = (envio.getIntentos() == null ? 0 : envio.getIntentos()) + 1;
        envio.setEstado(EstadoSunat.ENVIANDO);
        envio.setCodigoRespuesta(null);
        envio.setDescripcion(null);
        envio.setObservaciones(null);
        envio.setIntentos(nuevoIntento);
        envio.setEnviadoEn(ahoraLima);

        EnvioSunat guardado = repositorio.save(envio);
        return PreparacionEnvio.listoParaEnviar(guardado.getId(), nuevoIntento, nombre, zip);
    }

    private EnvioResponse registrarResultadoSunat(Long ordenId, Long envioId, int intentoEsperado,
                                                  ClienteSunat.Respuesta respuesta, String errorConexion) {
        jdbc.query("SELECT pg_advisory_xact_lock(?)", rs -> null, BASE_CANDADO + ordenId);

        EnvioSunat envio = repositorio.findById(envioId)
                .orElseThrow(() -> new IllegalStateException("Registro de envío SUNAT #" + envioId + " no encontrado"));

        if (envio.getEstado().esDefinitivo() || !Integer.valueOf(intentoEsperado).equals(envio.getIntentos())) {
            log.warn("Ignorando respuesta obsoleta de SUNAT para orden #{} (intento={}, actual={}, estado={})",
                    ordenId, intentoEsperado, envio.getIntentos(), envio.getEstado());
            return EnvioResponse.from(envio);
        }

        if (errorConexion != null) {
            envio.setEstado(EstadoSunat.ERROR);
            envio.setCodigoRespuesta(null);
            envio.setDescripcion(recortar(errorConexion, 1000));
        } else if (respuesta != null && respuesta.tieneCdr()) {
            envio.setCdrZip(respuesta.cdrZip());
            try {
                LectorCdr.Resultado cdr = LectorCdr.leer(respuesta.cdrZip());
                envio.setEstado(EstadoSunat.valueOf(cdr.estado().name()));
                envio.setCodigoRespuesta(recortar(cdr.codigo(), 50));
                envio.setDescripcion(recortar(cdr.descripcion(), 1000));
                envio.setObservaciones(cdr.observaciones().isEmpty() ? null : String.join("\n", cdr.observaciones()));
            } catch (RuntimeException ex) {
                log.error("No se pudo interpretar el CDR de la orden #{}: {}", ordenId, ex.getMessage());
                envio.setEstado(EstadoSunat.ERROR);
                envio.setCodigoRespuesta(null);
                envio.setDescripcion(recortar("CDR recibido pero ilegible: " + ex.getMessage(), 1000));
                envio.setObservaciones(null);
            }
        } else if (respuesta != null) {
            envio.setCdrZip(null);
            envio.setEstado(respuesta.errorTransitorio() ? EstadoSunat.ERROR : EstadoSunat.RECHAZADO);
            envio.setCodigoRespuesta(recortar(respuesta.codigoError(), 50));
            envio.setDescripcion(recortar(respuesta.mensajeError(), 1000));
            envio.setObservaciones(null);
        } else {
            envio.setEstado(EstadoSunat.ERROR);
            envio.setCodigoRespuesta(null);
            envio.setDescripcion("Respuesta vacía de SUNAT");
        }

        envio = repositorio.save(envio);
        log.info("Comprobante {} enviado a SUNAT: {} {} {}", envio.getSerieNumero(), envio.getEstado(),
                envio.getCodigoRespuesta(), envio.getDescripcion());
        return EnvioResponse.from(envio);
    }

    DocumentoVenta armarDocumento(ServiciosInternos.Comprobante c, ServiciosInternos.Orden orden) {
        if (c == null || c.serieCorrelativo() == null) {
            throw new IllegalStateException("El comprobante no tiene serie y correlativo");
        }
        DocumentoVenta.TipoDocumento tipo = "FACTURA".equalsIgnoreCase(c.tipo())
                ? DocumentoVenta.TipoDocumento.FACTURA : DocumentoVenta.TipoDocumento.BOLETA;

        var m = PATRON_SERIE_CORRELATIVO.matcher(c.serieCorrelativo().trim().toUpperCase());
        if (!m.matches()) {
            throw new IllegalStateException("Serie-correlativo inválido: " + c.serieCorrelativo());
        }
        String serie = m.group(1);
        char prefijoEsperado = tipo == DocumentoVenta.TipoDocumento.FACTURA ? 'F' : 'B';
        if (serie.charAt(0) != prefijoEsperado) {
            throw new IllegalStateException("La serie " + serie + " no corresponde a " + tipo.name());
        }
        long correlativo = Long.parseLong(m.group(2));
        if (correlativo <= 0) {
            throw new IllegalStateException("Correlativo inválido en " + c.serieCorrelativo());
        }

        List<CalculadoraMontos.ItemConIgv> items = orden.items() == null ? List.of() : orden.items().stream()
                .map(i -> new CalculadoraMontos.ItemConIgv(
                        i.productoId() == null ? "PROD" : "P" + i.productoId(),
                        i.productoNombre(),
                        BigDecimal.valueOf(i.cantidad() == null ? 1 : i.cantidad()),
                        i.precioUnitario()))
                .toList();
        CalculadoraMontos.Resultado montos = CalculadoraMontos.calcular(items, c.total());

        return new DocumentoVenta(tipo, serie, correlativo,
                c.emitidoEn() != null ? c.emitidoEn() : LocalDateTime.now(ZONA_LIMA),
                cliente(tipo, c), montos.lineas(), montos.totalValorVenta(), montos.totalIgv(), montos.totalPagar());
    }

    /** Catálogo 06: RUC = "6", DNI = "1", sin documento (venta interna) = "-". */
    static DocumentoVenta.Cliente cliente(DocumentoVenta.TipoDocumento tipo, ServiciosInternos.Comprobante c) {
        String numero = c.clienteNumDoc() == null ? "" : c.clienteNumDoc().trim();
        String tipoDoc;
        if (tipo == DocumentoVenta.TipoDocumento.FACTURA) {
            if (!numero.matches("\\d{11}")) {
                throw new IllegalStateException("Una factura necesita el RUC (11 dígitos) del cliente");
            }
            tipoDoc = "6";
        } else if (numero.matches("\\d{8}") && !numero.matches("0{8}")) {
            tipoDoc = "1";
        } else if (numero.matches("\\d{11}")) {
            tipoDoc = "6";
        } else {
            if (c.total() != null && c.total().compareTo(TOPE_BOLETA_SIN_DOC) > 0) {
                throw new IllegalStateException("Las boletas mayores a S/ 700.00 requieren DNI o RUC válido del cliente");
            }
            tipoDoc = "-";
            numero = "-";
        }
        String nombre = c.clienteNombre() == null || c.clienteNombre().isBlank() ? "CLIENTES VARIOS" : c.clienteNombre().trim();
        return new DocumentoVenta.Cliente(tipoDoc, numero, nombre, c.clienteDireccion());
    }

    private void guardarDatos(EnvioSunat envio, Long comprobanteId, DocumentoVenta d, String nombre,
                              FirmadorXml.Resultado firmado) {
        envio.setComprobanteId(comprobanteId);
        envio.setTipo(d.tipo().name());
        envio.setSerieNumero(d.numeroCompleto());
        envio.setNombreArchivo(nombre);
        envio.setHash(firmado.hash());
        envio.setXmlFirmado(new String(firmado.xmlFirmado(), StandardCharsets.UTF_8));
        envio.setClienteTipoDoc(d.cliente().tipoDocumento());
        envio.setClienteNumDoc(d.cliente().numeroDocumento());
        envio.setClienteNombre(d.cliente().nombre());
        envio.setClienteDireccion(d.cliente().direccion());
        envio.setTotalValorVenta(d.totalValorVenta());
        envio.setTotalIgv(d.totalIgv());
        envio.setTotal(d.totalPagar());
        envio.setFechaEmision(d.fechaEmision());
        try {
            envio.setLineasJson(json.writeValueAsString(d.lineas()));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudieron guardar las líneas del comprobante", e);
        }
    }

    @Transactional(readOnly = true)
    public EnvioSunat obtener(Long ordenId) {
        validarOrdenId(ordenId);
        return repositorio.findByOrdenId(ordenId)
                .orElseThrow(() -> new NoSuchElementException("La orden #" + ordenId + " aún no se envió a SUNAT"));
    }

    @Transactional(readOnly = true)
    public List<EnvioResponse> listar(EstadoSunat estado) {
        var pagina = PageRequest.of(0, 500);
        return estado != null
                ? repositorio.findResumenByEstado(estado, pagina)
                : repositorio.findResumenAll(pagina);
    }

    public List<DocumentoVenta.Linea> lineas(EnvioSunat envio) {
        try {
            return json.readValue(envio.getLineasJson(), new TypeReference<List<DocumentoVenta.Linea>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("Líneas del comprobante ilegibles", e);
        }
    }

    private static void validarOrdenId(Long ordenId) {
        if (ordenId == null || ordenId <= 0) {
            throw new IllegalArgumentException("El ID de orden debe ser un entero positivo");
        }
    }

    private static String recortar(String texto, int max) {
        if (texto == null) {
            return null;
        }
        return texto.length() > max ? texto.substring(0, max) : texto;
    }
}
