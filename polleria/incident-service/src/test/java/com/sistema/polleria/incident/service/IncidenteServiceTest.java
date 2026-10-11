package com.sistema.polleria.incident.service;

import com.sistema.polleria.incident.dto.CrearIncidenteRequest;
import com.sistema.polleria.incident.dto.IncidenteResponse;
import com.sistema.polleria.incident.dto.ResolverIncidenteRequest;
import com.sistema.polleria.incident.entity.EstadoIncidente;
import com.sistema.polleria.incident.entity.Incidente;
import com.sistema.polleria.incident.entity.Severidad;
import com.sistema.polleria.incident.entity.TipoIncidente;
import com.sistema.polleria.incident.repository.IncidenteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IncidenteServiceTest {

    @Mock
    private IncidenteRepository incidenteRepository;

    @InjectMocks
    private IncidenteService incidenteService;

    @Test
    @DisplayName("Debe registrar un nuevo incidente operativo en estado ABIERTO")
    void registrar_creaIncidenteAbierto() {
        when(incidenteRepository.save(any(Incidente.class))).thenAnswer(inv -> {
            Incidente inc = inv.getArgument(0);
            inc.setId(10L);
            return inc;
        });

        CrearIncidenteRequest req = CrearIncidenteRequest.builder()
                .titulo("Caída de conexión de terminal POS")
                .severidad(Severidad.ALTA)
                .tipo(TipoIncidente.TECNICO)
                .descripcion("El POS físico perdió enlace con el banco durante la hora pico")
                .responsable("Soporte Técnico")
                .build();

        IncidenteResponse res = incidenteService.registrar(req);

        assertThat(res.getId()).isEqualTo(10L);
        assertThat(res.getEstado()).isEqualTo(EstadoIncidente.ABIERTO);
        assertThat(res.getSeveridad()).isEqualTo(Severidad.ALTA);
        assertThat(res.getTitulo()).isEqualTo("Caída de conexión de terminal POS");
        verify(incidenteRepository).save(any(Incidente.class));
    }

    @Test
    @DisplayName("Debe resolver un incidente guardando causa raiz y solucion aplicada")
    void resolver_guardaCausaRaizYSolucion() {
        Incidente inc = Incidente.builder()
                .id(5L)
                .titulo("Horno principal no calienta")
                .severidad(Severidad.CRITICA)
                .tipo(TipoIncidente.OPERATIVO)
                .estado(EstadoIncidente.ABIERTO)
                .ocurridoEn(LocalDateTime.now().minusHours(2))
                .build();

        when(incidenteRepository.findById(5L)).thenReturn(Optional.of(inc));
        when(incidenteRepository.save(any(Incidente.class))).thenAnswer(inv -> inv.getArgument(0));

        ResolverIncidenteRequest req = ResolverIncidenteRequest.builder()
                .estado(EstadoIncidente.RESUELTO)
                .causaRaiz("Termostato averiado por acumulación de grasa")
                .solucionAplicada("Reemplazo de sensor y limpieza profunda del conducto")
                .responsable("Mantenimiento Externo")
                .build();

        IncidenteResponse res = incidenteService.resolver(5L, req);

        assertThat(res.getId()).isEqualTo(5L);
        assertThat(res.getEstado()).isEqualTo(EstadoIncidente.RESUELTO);
        assertThat(res.getCausaRaiz()).isEqualTo("Termostato averiado por acumulación de grasa");
        assertThat(res.getSolucionAplicada()).isEqualTo("Reemplazo de sensor y limpieza profunda del conducto");
        assertThat(res.getResponsable()).isEqualTo("Mantenimiento Externo");
        assertThat(res.getResueltoEn()).isNotNull();
        verify(incidenteRepository).save(inc);
    }

    @Test
    @DisplayName("Debe filtrar incidentes por severidad y estado")
    void listar_filtraCorrectamente() {
        Incidente i1 = Incidente.builder().id(1L).severidad(Severidad.CRITICA).estado(EstadoIncidente.ABIERTO).build();
        when(incidenteRepository.findBySeveridadAndEstadoOrderByOcurridoEnDesc(Severidad.CRITICA, EstadoIncidente.ABIERTO))
                .thenReturn(List.of(i1));

        List<IncidenteResponse> res = incidenteService.listar(Severidad.CRITICA, EstadoIncidente.ABIERTO);

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getId()).isEqualTo(1L);
        verify(incidenteRepository).findBySeveridadAndEstadoOrderByOcurridoEnDesc(Severidad.CRITICA, EstadoIncidente.ABIERTO);
    }
}
