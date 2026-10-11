package com.sistema.polleria.incident.service;

import com.sistema.polleria.incident.dto.CrearIncidenteRequest;
import com.sistema.polleria.incident.dto.IncidenteResponse;
import com.sistema.polleria.incident.dto.ResolverIncidenteRequest;
import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Incidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.repository.IncidenteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidenteService {

    private final IncidenteRepository incidenteRepository;

    @Transactional
    public IncidenteResponse registrar(CrearIncidenteRequest req) {
        Incidente incidente = Incidente.builder()
                .titulo(req.getTitulo())
                .severidad(req.getSeveridad())
                .tipo(req.getTipo())
                .descripcion(req.getDescripcion())
                .responsable(req.getResponsable())
                .estado(EstadoIncidente.ABIERTO)
                .ocurridoEn(LocalDateTime.now())
                .build();

        incidente = incidenteRepository.save(incidente);
        log.warn("Incidente operativo #{} registrado: [{}] {} - Severidad: {}",
                incidente.getId(), incidente.getTipo(), incidente.getTitulo(), incidente.getSeveridad());

        return IncidenteResponse.from(incidente);
    }

    public List<IncidenteResponse> listar(Severidad severidad, EstadoIncidente estado) {
        if (severidad != null && estado != null) {
            return incidenteRepository.findBySeveridadAndEstadoOrderByOcurridoEnDesc(severidad, estado)
                    .stream().map(IncidenteResponse::from).toList();
        } else if (severidad != null) {
            return incidenteRepository.findBySeveridadOrderByOcurridoEnDesc(severidad)
                    .stream().map(IncidenteResponse::from).toList();
        } else if (estado != null) {
            return incidenteRepository.findByEstadoOrderByOcurridoEnDesc(estado)
                    .stream().map(IncidenteResponse::from).toList();
        }
        return incidenteRepository.findAllByOrderByOcurridoEnDesc()
                .stream().map(IncidenteResponse::from).toList();
    }

    public IncidenteResponse obtenerPorId(Long id) {
        return IncidenteResponse.from(buscarOFallar(id));
    }

    @Transactional
    public IncidenteResponse resolver(Long id, ResolverIncidenteRequest req) {
        Incidente incidente = buscarOFallar(id);

        incidente.setEstado(req.getEstado() != null ? req.getEstado() : EstadoIncidente.RESUELTO);
        incidente.setCausaRaiz(req.getCausaRaiz());
        incidente.setSolucionAplicada(req.getSolucionAplicada());
        incidente.setResueltoEn(LocalDateTime.now());
        if (req.getResponsable() != null) {
            incidente.setResponsable(req.getResponsable());
        }

        incidente = incidenteRepository.save(incidente);
        log.info("Incidente #{} resuelto y documentado: {}", incidente.getId(), incidente.getTitulo());

        return IncidenteResponse.from(incidente);
    }

    private Incidente buscarOFallar(Long id) {
        return incidenteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Incidente no encontrado: " + id));
    }
}
