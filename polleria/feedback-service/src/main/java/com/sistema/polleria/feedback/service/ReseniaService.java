package com.sistema.polleria.feedback.service;

import com.sistema.polleria.feedback.dto.CrearReseniaRequest;
import com.sistema.polleria.feedback.dto.ProductoReseniasResponse;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.entity.Resenia;
import com.sistema.polleria.feedback.repository.ReseniaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReseniaService {

    private final ReseniaRepository reseniaRepository;
    private final OrdersClient ordersClient;

    @Transactional
    public ReseniaResponse crear(CrearReseniaRequest request, Long clienteId) {
        // 1. Validar orden contra orders-service
        ordersClient.obtenerYValidarOrden(request.getOrdenId(), clienteId, false);

        // 2. Pre-chequeo en memoria
        if (reseniaRepository.existsByOrdenIdAndClienteId(request.getOrdenId(), clienteId)) {
            throw new IllegalStateException("Ya existe una reseña registrada para la orden #" + request.getOrdenId());
        }

        Resenia resenia = Resenia.builder()
                .ordenId(request.getOrdenId())
                .clienteId(clienteId)
                .productoId(request.getProductoId())
                .calificacion(request.getCalificacion())
                .comentario(request.getComentario())
                .visible(true)
                .build();

        try {
            resenia = reseniaRepository.save(resenia);
        } catch (DataIntegrityViolationException e) {
            // Protección contra race conditions (TOCTOU)
            throw new IllegalStateException("Ya existe una reseña registrada para la orden #" + request.getOrdenId());
        }

        log.info("Reseña creada para orden #{} por cliente #{}, estrellas: {}",
                resenia.getOrdenId(), clienteId, resenia.getCalificacion());
        return ReseniaResponse.from(resenia);
    }

    public List<ReseniaResponse> listarPorCliente(Long clienteId) {
        return reseniaRepository.findByClienteIdOrderByCreadoEnDesc(clienteId)
                .stream().map(ReseniaResponse::from).toList();
    }

    public List<ReseniaResponse> listarPorOrden(Long ordenId) {
        return reseniaRepository.findByOrdenId(ordenId)
                .stream().map(ReseniaResponse::from).toList();
    }

    public List<ReseniaResponse> listarTodas() {
        return reseniaRepository.findByVisibleTrueOrderByCreadoEnDesc()
                .stream().map(ReseniaResponse::from).toList();
    }

    public List<ReseniaResponse> listarTodasAdmin() {
        return reseniaRepository.findAllByOrderByCreadoEnDesc()
                .stream().map(ReseniaResponse::from).toList();
    }

    public ProductoReseniasResponse obtenerResumenProducto(Long productoId) {
        List<Resenia> resenias = reseniaRepository.findByProductoIdAndVisibleTrueOrderByCreadoEnDesc(productoId);
        List<ReseniaResponse> responses = resenias.stream().map(ReseniaResponse::from).toList();

        double promedio = resenias.stream()
                .mapToInt(Resenia::getCalificacion)
                .average()
                .orElse(5.0);

        return ProductoReseniasResponse.builder()
                .productoId(productoId)
                .promedioCalificacion(Math.round(promedio * 10.0) / 10.0)
                .totalResenias(responses.size())
                .resenias(responses)
                .build();
    }

    @Transactional
    public ReseniaResponse responder(Long id, String respuestaAdmin) {
        Resenia resenia = buscarOFallar(id);
        resenia.setRespuestaAdmin(respuestaAdmin);
        resenia.setRespondidoEn(LocalDateTime.now());
        resenia = reseniaRepository.save(resenia);
        log.info("Respuesta agregada a reseña #{}", id);
        return ReseniaResponse.from(resenia);
    }

    @Transactional
    public ReseniaResponse cambiarVisibilidad(Long id, boolean visible) {
        Resenia resenia = buscarOFallar(id);
        resenia.setVisible(visible);
        resenia = reseniaRepository.save(resenia);
        log.info("Visibilidad de reseña #{} cambiada a {}", id, visible);
        return ReseniaResponse.from(resenia);
    }

    private Resenia buscarOFallar(Long id) {
        return reseniaRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reseña no encontrada: " + id));
    }
}
