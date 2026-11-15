package com.sistema.polleria.orders.scheduler;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.service.OrdenService;
import com.sistema.polleria.orders.service.SancionDispatcherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler encargado de monitorear y aplicar los SLAs de expiración usando bloqueo
 * pesimista con {@code SKIP LOCKED} cuando hay administrador de transacciones activo.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrdenExpiracionScheduler {

    private final OrdenRepository ordenRepository;
    private final OrdenService ordenService;
    private final SancionDispatcherService sancionDispatcherService;

    @Autowired(required = false)
    private PlatformTransactionManager transactionManager;

    // Ejecuta cada 30 segundos
    @Scheduled(fixedDelay = 30000, initialDelay = 10000)
    public void verificarExpiraciones() {
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime limite15m = ahora.minusMinutes(15);
        LocalDateTime limite30m = ahora.minusMinutes(30);
        LocalDateTime limite1h = ahora.minusHours(1);

        ejecutarEnTransaccion(() -> procesarExpiradosConfirmacion(limite15m));
        ejecutarEnTransaccion(() -> procesarExpiradosPago(limite15m, ahora));
        ejecutarEnTransaccion(() -> procesarExpiradosEnPuerta(limite30m));
        ejecutarEnTransaccion(() -> procesarExpiradosRecojo(limite1h));
    }

    private void ejecutarEnTransaccion(Runnable bloque) {
        if (transactionManager == null) {
            bloque.run();
            return;
        }
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> bloque.run());
    }

    private void procesarExpiradosConfirmacion(LocalDateTime limite15m) {
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
    }

    private void procesarExpiradosPago(LocalDateTime limite15m, LocalDateTime ahora) {
        List<Orden> expiradosPago = ordenRepository.findExpiradosPago(limite15m, ahora);
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
    }

    private void procesarExpiradosEnPuerta(LocalDateTime limite30m) {
        List<Orden> expiradosEnPuerta = ordenRepository.findExpiradosEnPuerta(limite30m);
        for (Orden o : expiradosEnPuerta) {
            try {
                log.warn("Marcando orden #{} como PEDIDO_FANTASMA por superar 30 min en puerta", o.getId());
                ordenService.declararPedidoFantasma(o.getId(), "NO_ENTREGADO", 0L);
            } catch (Exception e) {
                log.error("Error al marcar pedido fantasma en puerta #{}: {}", o.getId(), e.getMessage());
            }
        }
    }

    private void procesarExpiradosRecojo(LocalDateTime limite1h) {
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
