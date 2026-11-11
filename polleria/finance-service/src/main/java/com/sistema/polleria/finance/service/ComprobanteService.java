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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Issues one receipt per order and, on request, its cash income in the same transaction (D3.2).
 * Each rule lives in its own component (D3.19); this service only coordinates them.
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

    private static final BigDecimal IGV_DIVISOR = new BigDecimal("1.18");

    @Transactional
    public ComprobanteResponse emitir(EmitirComprobanteRequest req, Long usuarioId, String bearer) {
        // Idempotent per order: a retry returns the same receipt and only completes what is missing.
        var existente = comprobanteRepository.findByOrdenId(req.ordenId());
        if (existente.isPresent()) {
            log.info("Comprobante existente retornado para orden #{}", req.ordenId());
            return completarIngreso(existente.get(), req, usuarioId, bearer);
        }

        BigDecimal total = fuenteTotal.totalDe(req.ordenId(), bearer).setScale(2, RoundingMode.HALF_UP);
        validadorDatosFiscales.validar(req.tipo(), req.clienteNumDoc(), total);

        String serieCorrelativo = generadorCorrelativo.siguiente(req.tipo());
        // Another emission of this order may have committed while we waited for the lock.
        var ganador = comprobanteRepository.findByOrdenId(req.ordenId());
        if (ganador.isPresent()) {
            return completarIngreso(ganador.get(), req, usuarioId, bearer);
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
                .build());
        log.info("Comprobante emitido: {} para orden #{} (Total: S/ {})", serieCorrelativo, req.ordenId(), total);

        return completarIngreso(comprobante, req, usuarioId, bearer);
    }

    private ComprobanteResponse completarIngreso(ComprobantePago comprobante, EmitirComprobanteRequest req,
                                                 Long usuarioId, String bearer) {
        if (req.registraIngresoCaja()) {
            validadorIngresoEfectivo.validar(comprobante.getOrdenId(), bearer);
            registradorIngresoCaja.registrar(comprobante.getOrdenId(), comprobante.getTotal(),
                    "Venta " + comprobante.getSerieCorrelativo() + " - Orden #" + comprobante.getOrdenId(),
                    usuarioId);
        }
        return ComprobanteResponse.from(comprobante);
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
        return comprobanteRepository.findAll().stream().map(ComprobanteResponse::from).toList();
    }
}
