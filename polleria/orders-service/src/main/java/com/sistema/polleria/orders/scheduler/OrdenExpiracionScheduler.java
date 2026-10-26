package com.sistema.polleria.orders.scheduler;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.service.OrdenService;
import com.sistema.polleria.orders.service.SancionDispatcherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler encargado de monitorear y aplicar los SLAs de expiración:
 * 1. 15 min: PENDIENTE_CONFIRMACION (ContraPago sin llamada confirmada) -> CANCELADO
 * 2. 15 min: PENDIENTE_PAGO (WhatsApp Yape/Plin sin captura validada) -> CANCELADO
 * 3. 30 min: EN_PUERTA (Repartidor esperando en puerta sin entrega) -> PEDIDO_FANTASMA
 * 4. 1 hora: LISTO / LISTO_PARA_ENTREGAR en RECOJO (Cliente no recogió) -> PEDIDO_FANTASMA
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrdenExpiracionScheduler {

    private final OrdenRepository ordenRepository;
    private final OrdenService ordenService;
    private final SancionDispatcherService sancionDispatcherService;

    // Ejecuta cada 30 segundos
    @Scheduled(fixedDelay = 30000, initialDelay = 10000)
    public void verificarExpiraciones() {
        LocalDateTime ahora = LocalDateTime.now();

        // 1. SLA 15 min: ContraPago pendiente de llamada de confirmación
        LocalDateTime limite15m = ahora.minusMinutes(15);
        List<Orden> expiradosConfirmacion = ordenRepository.findExpiradosConfirmacion(limite15m);
        for (Orden o : expiradosConfirmacion) {
            try {
                log.warn("Expirando orden #{} por superar 15 min en PENDIENTE_CONFIRMACION", o.getId());
                ActualizarEstadoRequest req = new ActualizarEstadoRequest();
                req.setEstado(OrdenEstado.CANCELADO);
                ordenService.actualizarEstado(o.getId(), req, 0L);
            } catch (Exception e) {
                log.error("Error al cancelar orden expirada #{}: {}", o.getId(), e.getMessage());
            }
        }

        // 2. SLA 15 min: WhatsApp Yape/Plin pendiente de captura
        List<Orden> expiradosPago = ordenRepository.findExpiradosPago(limite15m);
        for (Orden o : expiradosPago) {
            try {
                log.warn("Expirando orden #{} por superar 15 min en PENDIENTE_PAGO", o.getId());
                ActualizarEstadoRequest req = new ActualizarEstadoRequest();
                req.setEstado(OrdenEstado.CANCELADO);
                ordenService.actualizarEstado(o.getId(), req, 0L);
            } catch (Exception e) {
                log.error("Error al cancelar orden impaga #{}: {}", o.getId(), e.getMessage());
            }
        }

        // 3. SLA 30 min: Repartidor esperando en la puerta
        LocalDateTime limite30m = ahora.minusMinutes(30);
        List<Orden> expiradosEnPuerta = ordenRepository.findExpiradosEnPuerta(limite30m);
        for (Orden o : expiradosEnPuerta) {
            try {
                log.warn("Marcando orden #{} como PEDIDO_FANTASMA por superar 30 min en puerta", o.getId());
                ordenService.declararPedidoFantasma(o.getId(), "NO_ENTREGADO", 0L);
            } catch (Exception e) {
                log.error("Error al marcar pedido fantasma en puerta #{}: {}", o.getId(), e.getMessage());
            }
        }

        // 4. SLA 1 hora: Recojo en tienda listo sin recoger
        LocalDateTime limite1h = ahora.minusHours(1);
        List<Orden> expiradosRecojo = ordenRepository.findExpiradosRecojo(limite1h);
        for (Orden o : expiradosRecojo) {
            try {
                log.warn("Marcando orden de recojo #{} como PEDIDO_FANTASMA por superar 1 hora sin recoger", o.getId());
                ordenService.declararPedidoFantasma(o.getId(), "ABANDONADO", 0L);
            } catch (Exception e) {
                log.error("Error al marcar pedido fantasma en recojo #{}: {}", o.getId(), e.getMessage());
            }
        }
    }
}
