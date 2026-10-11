package com.sistema.polleria.payments.service;

import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.entity.EstadoPago;
import com.sistema.polleria.payments.entity.MetodoPago;
import com.sistema.polleria.payments.entity.Pago;
import com.sistema.polleria.payments.repository.PagoRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PagoServiceTest {

    @Mock
    private PagoRepository pagoRepository;

    @InjectMocks
    private PagoService pagoService;

    @Test
    @DisplayName("Debe procesar el reembolso de un pago previamente aprobado")
    void reembolsar_exitoso() {
        Pago pagoAprobado = new Pago();
        pagoAprobado.setId(1L);
        pagoAprobado.setOrdenId(100L);
        pagoAprobado.setClienteId(7L);
        pagoAprobado.setMonto(new BigDecimal("85.50"));
        pagoAprobado.setMetodoPago(MetodoPago.TARJETA);
        pagoAprobado.setEstado(EstadoPago.APROBADO);
        pagoAprobado.setCreadoEn(LocalDateTime.now());

        when(pagoRepository.findById(1L)).thenReturn(Optional.of(pagoAprobado));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.reembolsar(1L, new BigDecimal("85.50"), "Pedido llegó frío y cliente canceló");

        assertThat(res.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(pagoAprobado.getEstado()).isEqualTo(EstadoPago.REEMBOLSADO);
        assertThat(pagoAprobado.getDetalle()).contains("Reembolso procesado por S/ 85.50");
        verify(pagoRepository).save(pagoAprobado);
    }

    @Test
    @DisplayName("Debe fallar al reembolsar si el pago no se encuentra en estado APROBADO")
    void reembolsar_fallaSiEstadoInvalido() {
        Pago pagoPendiente = new Pago();
        pagoPendiente.setId(2L);
        pagoPendiente.setOrdenId(101L);
        pagoPendiente.setClienteId(8L);
        pagoPendiente.setMonto(new BigDecimal("45.00"));
        pagoPendiente.setMetodoPago(MetodoPago.YAPE_PLIN);
        pagoPendiente.setEstado(EstadoPago.PENDIENTE);

        when(pagoRepository.findById(2L)).thenReturn(Optional.of(pagoPendiente));

        assertThatThrownBy(() -> pagoService.reembolsar(2L, new BigDecimal("45.00"), "Error"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Solo se pueden reembolsar pagos que hayan sido APROBADOS");

        verify(pagoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Debe reembolsar buscando el pago por su ordenId")
    void reembolsarPorOrden_exitoso() {
        Pago pago = new Pago();
        pago.setId(3L);
        pago.setOrdenId(250L);
        pago.setClienteId(9L);
        pago.setMonto(new BigDecimal("60.00"));
        pago.setMetodoPago(MetodoPago.CONTRAENTREGA);
        pago.setEstado(EstadoPago.APROBADO);

        when(pagoRepository.findByOrdenId(250L)).thenReturn(Optional.of(pago));
        when(pagoRepository.findById(3L)).thenReturn(Optional.of(pago));
        when(pagoRepository.save(any(Pago.class))).thenAnswer(inv -> inv.getArgument(0));

        PagoResponse res = pagoService.reembolsarPorOrden(250L, new BigDecimal("60.00"), "Error en entrega");

        assertThat(res.estado()).isEqualTo(EstadoPago.REEMBOLSADO);
        verify(pagoRepository).findByOrdenId(250L);
        verify(pagoRepository).save(pago);
    }
}
