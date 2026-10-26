package com.sistema.polleria.finance.service;

import com.sistema.polleria.finance.dto.ComprobanteResponse;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ComprobanteService {

    private final ComprobantePagoRepository comprobanteRepository;

    private static final BigDecimal IGV_DIVISOR = new BigDecimal("1.18");

    @Transactional
    public ComprobanteResponse emitir(EmitirComprobanteRequest req, Long usuarioId) {
        // Idempotencia: si ya existe para esta orden, devolverlo
        var existente = comprobanteRepository.findByOrdenId(req.ordenId());
        if (existente.isPresent()) {
            log.info("Comprobante existente retornado para orden #{}", req.ordenId());
            return ComprobanteResponse.from(existente.get());
        }

        long correlativoNum = comprobanteRepository.contarPorTipo(req.tipo()) + 1;
        String prefijo = req.tipo() == TipoComprobante.FACTURA ? "F001-" : "B001-";
        String serieCorrelativo = String.format("%s%06d", prefijo, correlativoNum);

        // Desglose de impuesto
        BigDecimal total = req.total().setScale(2, RoundingMode.HALF_UP);
        BigDecimal subtotal = total.divide(IGV_DIVISOR, 2, RoundingMode.HALF_UP);
        BigDecimal igv = total.subtract(subtotal);

        // Leyenda para ticket de cocina/repartidor
        String estadoTexto;
        if (Boolean.TRUE.equals(req.pagadoDigitalmente())) {
            estadoTexto = "PAGADO";
        } else {
            estadoTexto = "COBRAR EN EFECTIVO: S/ " + total;
            if (req.vueltoEstimado() != null && req.vueltoEstimado().compareTo(BigDecimal.ZERO) > 0) {
                estadoTexto += " (VUELTO: S/ " + req.vueltoEstimado().setScale(2, RoundingMode.HALF_UP) + ")";
            }
        }

        ComprobantePago comprobante = ComprobantePago.builder()
                .ordenId(req.ordenId())
                .tipo(req.tipo())
                .serieCorrelativo(serieCorrelativo)
                .clienteTipoDoc(req.clienteTipoDoc() != null ? req.clienteTipoDoc() : (req.tipo() == TipoComprobante.FACTURA ? "RUC" : "DNI"))
                .clienteNumDoc(req.clienteNumDoc())
                .clienteNombre(req.clienteNombre())
                .clienteDireccion(req.clienteDireccion())
                .subtotal(subtotal)
                .igv(igv)
                .total(total)
                .estadoPagoTexto(estadoTexto)
                .vueltoEntregado(req.vueltoEstimado() != null ? req.vueltoEstimado() : BigDecimal.ZERO)
                .emitidoEn(LocalDateTime.now())
                .emitidoPor(usuarioId)
                .build();

        comprobante = comprobanteRepository.save(comprobante);
        log.info("Comprobante emitido: {} para orden #{} (Total: S/ {}, Estado: {})",
                serieCorrelativo, req.ordenId(), total, estadoTexto);

        return ComprobanteResponse.from(comprobante);
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
