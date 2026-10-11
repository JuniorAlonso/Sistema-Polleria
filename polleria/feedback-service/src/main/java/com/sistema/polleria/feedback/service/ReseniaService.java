package com.sistema.polleria.feedback.service;

import com.sistema.polleria.feedback.dto.CrearReseniaRequest;
import com.sistema.polleria.feedback.dto.ProductoReseniasResponse;
import com.sistema.polleria.feedback.dto.ReseniaResponse;
import com.sistema.polleria.feedback.entity.Resenia;
import com.sistema.polleria.feedback.repository.ReseniaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReseniaService {

    private final ReseniaRepository reseniaRepository;

    @Transactional
    public ReseniaResponse crear(CrearReseniaRequest request, Long clienteId) {
        if (reseniaRepository.existsByOrdenIdAndClienteId(request.getOrdenId(), clienteId)) {
            throw new IllegalStateException("Ya existe una reseña registrada para la orden #" + request.getOrdenId());
        }

        Resenia resenia = Resenia.builder()
                .ordenId(request.getOrdenId())
                .clienteId(clienteId)
                .calificacion(request.getCalificacion())
                .comentario(request.getComentario())
                .build();

        resenia = reseniaRepository.save(resenia);
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
        return reseniaRepository.findAllByOrderByCreadoEnDesc()
                .stream().map(ReseniaResponse::from).toList();
    }

    public ProductoReseniasResponse obtenerResumenProducto(Long productoId) {
        List<ReseniaResponse> resenias = listarTodas();
        double promedio = resenias.stream()
                .mapToInt(ReseniaResponse::getCalificacion)
                .average()
                .orElse(5.0);

        return ProductoReseniasResponse.builder()
                .productoId(productoId)
                .promedioCalificacion(Math.round(promedio * 10.0) / 10.0)
                .totalResenias(resenias.size())
                .resenias(resenias)
                .build();
    }
}
