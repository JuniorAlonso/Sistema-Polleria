package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.gateway.ContraentregaGateway;
import com.sistema.polleria.payments.gateway.GatewayResult;
import com.sistema.polleria.payments.gateway.TarjetaGateway;
import com.sistema.polleria.payments.gateway.YapePlinGateway;
import com.sistema.polleria.payments.repository.PagoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class PagoService {

    private final PagoRepository pagoRepository;
    private final ContraentregaGateway contraentregaGateway;
    private final TarjetaGateway tarjetaGateway;
    private final YapePlinGateway yapePlinGateway;
    private final RestClient ordersRestClient;

    @Transactional
    public PagoResponse iniciar(IniciarPagoRequest request, Long clienteId, String bearerToken) {
        if (pagoRepository.findByOrdenId(request.ordenId()).isPresent()) {
            throw new IllegalStateException("Ya existe un pago registrado para la orden " + request.ordenId());
        }

        GatewayResult result = switch (request.metodoPago()) {
            case CONTRAENTREGA -> contraentregaGateway.procesar(request, clienteId);
            case TARJETA       -> tarjetaGateway.procesar(request, clienteId);
            case YAPE_PLIN     -> yapePlinGateway.procesar(request, clienteId);
        };

        Pago pago = new Pago();
        pago.setOrdenId(request.ordenId());
        pago.setClienteId(clienteId);
        pago.setMonto(request.monto());
        pago.setMetodoPago(request.metodoPago());
        pago.setEstado(result.estado());
        pago.setReferenciaExterna(result.referenciaExterna());
        pago.setDetalle(result.detalle());
        pago = pagoRepository.save(pago);

        if (result.estado() == EstadoPago.APROBADO) {
            notificarOrdenAsync(request.ordenId(), bearerToken);
        }

        log.info("Pago iniciado — id={} orden={} método={} estado={}",
                pago.getId(), pago.getOrdenId(), pago.getMetodoPago(), pago.getEstado());

        return PagoResponse.from(pago);
    }

    public PagoResponse obtener(Long id) {
        return PagoResponse.from(buscar(id));
    }

    public PagoResponse obtenerPorOrden(Long ordenId) {
        return PagoResponse.from(
            pagoRepository.findByOrdenId(ordenId)
                .orElseThrow(() -> new NoSuchElementException("No hay pago para la orden " + ordenId))
        );
    }

    public List<PagoResponse> misOrdenes(Long clienteId) {
        return pagoRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(PagoResponse::from).toList();
    }

    public List<PagoResponse> todos() {
        return pagoRepository.findAllByOrderByCreadoEnDesc()
                .stream().map(PagoResponse::from).toList();
    }

    @Transactional
    public PagoResponse confirmar(Long id, ConfirmarPagoRequest req, String bearerToken) {
        Pago pago = buscar(id);
        validarTransicion(pago.getEstado(), EstadoPago.APROBADO);
        pago.setEstado(EstadoPago.APROBADO);
        pago.setReferenciaExterna(req.referenciaExterna());
        pago.setDetalle(req.detalle());
        pago = pagoRepository.save(pago);
        notificarOrdenAsync(pago.getOrdenId(), bearerToken);
        log.info("Pago confirmado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    @Transactional
    public PagoResponse cancelar(Long id) {
        Pago pago = buscar(id);
        validarTransicion(pago.getEstado(), EstadoPago.CANCELADO);
        pago.setEstado(EstadoPago.CANCELADO);
        pago.setDetalle("Pago cancelado");
        pago = pagoRepository.save(pago);
        log.info("Pago cancelado — id={} orden={}", pago.getId(), pago.getOrdenId());
        return PagoResponse.from(pago);
    }

    // ─── helpers ────────────────────────────────────────────────────

    private Pago buscar(Long id) {
        return pagoRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Pago no encontrado: " + id));
    }

    private void validarTransicion(EstadoPago actual, EstadoPago nuevo) {
        if (actual == EstadoPago.APROBADO || actual == EstadoPago.CANCELADO) {
            throw new IllegalStateException(
                "No se puede cambiar un pago en estado " + actual + " a " + nuevo);
        }
    }

    /**
     * Notifica al orders-service de forma asíncrona que el pago fue aprobado
     * para que actualice el estado de la orden a CONFIRMADO.
     */
    @Async
    protected void notificarOrdenAsync(Long ordenId, String bearerToken) {
        try {
            ordersRestClient.patch()
                    .uri("/ordenes/{id}/estado", ordenId)
                    .header("Authorization", bearerToken)
                    .body(Map.of("estado", "CONFIRMADO"))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Orden {} actualizada a CONFIRMADO tras pago aprobado", ordenId);
        } catch (Exception e) {
            log.error("No se pudo notificar al orders-service para orden {}: {}", ordenId, e.getMessage());
        }
    }
}
