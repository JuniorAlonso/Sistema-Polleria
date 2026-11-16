package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
import com.sistema.polleria.finance.service.comprobante.FuenteTotalComprobante;
import com.sistema.polleria.finance.service.comprobante.GeneradorCorrelativo;
import com.sistema.polleria.finance.service.comprobante.RegistradorIngresoCaja;
import com.sistema.polleria.finance.service.comprobante.ValidadorDatosFiscales;
import com.sistema.polleria.finance.service.comprobante.ValidadorIngresoEfectivo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.function.Supplier;

/**
 * Issues one receipt per order and, on request, its cash income in the same transaction (D3.2).
 * Remote calls execute before acquiring the advisory lock or opening the write transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComprobanteService {

    private final ComprobantePagoRepository comprobanteRepository;
    private final FuenteTotalComprobante fuenteTotal;
    private final ValidadorDatosFiscales validadorDatosFiscales;
    private final GeneradorCorrelativo generadorCorrelativo;
    private final RegistradorIngresoCaja registradorIngresoCaja;
    private final ValidadorIngresoEfectivo validadorIngresoEfectivo;

    @Autowired(required = false)
    private OrdenesClient ordenesClient;

    @Autowired(required = false)
    private PlatformTransactionManager transactionManager;

    private static final BigDecimal IGV_DIVISOR = new BigDecimal("1.18");

    public ComprobanteResponse emitir(EmitirComprobanteRequest req, Long usuarioId, String bearer) {
        var existenteOpt = comprobanteRepository.findByOrdenId(req.ordenId());
        if (existenteOpt.isPresent()) {
            ComprobantePago existente = existenteOpt.get();
            if (Boolean.TRUE.equals(existente.getAnulado())) {
                throw new IllegalStateException("El comprobante de la orden #" + req.ordenId() + " fue anulado");
            }
            log.info("Comprobante existente retornado para orden #{}", req.ordenId());
            if (req.registraIngresoCaja()) {
                validadorIngresoEfectivo.validar(existente.getOrdenId(), bearer);
                ejecutarEnTransaccion(() -> {
                    registradorIngresoCaja.registrar(existente.getOrdenId(), existente.getTotal(),
                            "Venta " + existente.getSerieCorrelativo() + " - Orden #" + existente.getOrdenId(),
                            usuarioId);
                    return null;
                });
            }
            return ComprobanteResponse.from(existente);
        }

        if (ordenesClient != null) {
            ordenesClient.validarOrdenEmitible(req.ordenId());
        }
        BigDecimal total = fuenteTotal.totalDe(req.ordenId(), bearer).setScale(2, RoundingMode.HALF_UP);
        validadorDatosFiscales.validar(req.tipo(), req.clienteNumDoc(), total);
        if (req.registraIngresoCaja()) {
            validadorIngresoEfectivo.validar(req.ordenId(), bearer);
        }

        return ejecutarEnTransaccion(() -> {
            String serieCorrelativo = generadorCorrelativo.siguiente(req.tipo());
            // Another emission of this order may have committed while we waited for the lock.
            var ganadorOpt = comprobanteRepository.findByOrdenId(req.ordenId());
            if (ganadorOpt.isPresent()) {
                ComprobantePago ganador = ganadorOpt.get();
                if (Boolean.TRUE.equals(ganador.getAnulado())) {
                    throw new IllegalStateException("El comprobante de la orden #" + req.ordenId() + " fue anulado");
                }
                if (req.registraIngresoCaja()) {
                    registradorIngresoCaja.registrar(ganador.getOrdenId(), ganador.getTotal(),
                            "Venta " + ganador.getSerieCorrelativo() + " - Orden #" + ganador.getOrdenId(),
                            usuarioId);
                }
                return ComprobanteResponse.from(ganador);
            }

            BigDecimal subtotal = total.divide(IGV_DIVISOR, 2, RoundingMode.HALF_UP);
            BigDecimal igv = total.subtract(subtotal);

            ComprobantePago comprobante = comprobanteRepository.save(ComprobantePago.builder()
                    .ordenId(req.ordenId())
                    .tipo(req.tipo())
                    .serieCorrelativo(serieCorrelativo)
                    .clienteTipoDoc(req.clienteTipoDoc() != null ? req.clienteTipoDoc()
                            : (req.tipo() == TipoComprobante.FACTURA ? "RUC" : "DNI"))
                    .clienteNumDoc(req.clienteNumDoc())
                    .clienteNombre(req.clienteNombre())
                    .clienteDireccion(req.clienteDireccion())
                    .subtotal(subtotal)
                    .igv(igv)
                    .total(total)
                    .estadoPagoTexto(estadoPagoTexto(req, total))
                    .vueltoEntregado(req.vueltoEstimado() != null ? req.vueltoEstimado() : BigDecimal.ZERO)
                    .emitidoEn(LocalDateTime.now())
                    .emitidoPor(usuarioId)
                    .anulado(Boolean.FALSE)
                    .build());
            log.info("Comprobante emitido: {} para orden #{} (Total: S/ {})", serieCorrelativo, req.ordenId(), total);

            if (req.registraIngresoCaja()) {
                registradorIngresoCaja.registrar(comprobante.getOrdenId(), comprobante.getTotal(),
                        "Venta " + comprobante.getSerieCorrelativo() + " - Orden #" + comprobante.getOrdenId(),
                        usuarioId);
            }
            return ComprobanteResponse.from(comprobante);
        });
    }

    @Transactional
    public ComprobanteResponse anularPorOrden(Long ordenId, String motivo, Long usuarioId) {
        ComprobantePago comprobante = comprobanteRepository.findByOrdenIdParaActualizar(ordenId)
                .orElseThrow(() -> new NoSuchElementException("Comprobante no encontrado para orden #" + ordenId));
        if (Boolean.TRUE.equals(comprobante.getAnulado())) {
            return ComprobanteResponse.from(comprobante);
        }
        comprobante.setAnulado(Boolean.TRUE);
        comprobante.setAnuladoEn(LocalDateTime.now());
        comprobante.setMotivoAnulacion(motivo != null && !motivo.isBlank() ? motivo.trim() : "Pedido cancelado");
        comprobante = comprobanteRepository.save(comprobante);
        log.info("Comprobante {} anulado para orden #{} por usuario {}: {}",
                comprobante.getSerieCorrelativo(), ordenId, usuarioId, comprobante.getMotivoAnulacion());
        return ComprobanteResponse.from(comprobante);
    }

    private <T> T ejecutarEnTransaccion(Supplier<T> accion) {
        if (transactionManager == null) {
            return accion.get();
        }
        return new TransactionTemplate(transactionManager).execute(status -> accion.get());
    }

    /** Legend for the kitchen/courier ticket. */
    private static String estadoPagoTexto(EmitirComprobanteRequest req, BigDecimal total) {
        if (Boolean.TRUE.equals(req.pagadoDigitalmente())) {
            return "PAGADO";
        }
        String texto = "COBRAR EN EFECTIVO: S/ " + total;
        if (req.vueltoEstimado() != null && req.vueltoEstimado().compareTo(BigDecimal.ZERO) > 0) {
            texto += " (VUELTO: S/ " + req.vueltoEstimado().setScale(2, RoundingMode.HALF_UP) + ")";
        }
        return texto;
    }

    @Transactional(readOnly = true)
    public ComprobanteResponse obtenerPorOrdenId(Long ordenId) {
        return comprobanteRepository.findByOrdenId(ordenId)
                .map(ComprobanteResponse::from)
                .orElseThrow(() -> new NoSuchElementException("Comprobante no encontrado para orden #" + ordenId));
    }

    @Transactional(readOnly = true)
    public List<ComprobanteResponse> listarTodos() {
        return comprobanteRepository.findAllByOrderByEmitidoEnDesc(PageRequest.of(0, 500))
                .stream().map(ComprobanteResponse::from).toList();
    }
}
