package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * RF31 — Envía al notification-service los cambios de estado de pedidos DELIVERY.
 * El notification-service los encola y los manda por WhatsApp respetando el rate-limit (RNF10).
 */
@Slf4j
@Service
public class NotificationService {

    private static final Set<OrdenEstado> ESTADOS_NOTIFICABLES_DELIVERY =
            Set.of(OrdenEstado.EN_PREPARACION, OrdenEstado.PREPARANDO, OrdenEstado.EN_CAMINO,
                   OrdenEstado.EN_PUERTA, OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO);

    private static final Set<OrdenEstado> ESTADOS_NOTIFICABLES_RECOJO =
            Set.of(OrdenEstado.PREPARANDO, OrdenEstado.LISTO, OrdenEstado.LISTO_PARA_ENTREGAR,
                   OrdenEstado.ENTREGADO, OrdenEstado.CANCELADO);

    private final RestClient restClient;
    private final String notificationUrl;
    private final String internalKey;

    public NotificationService(
            @Value("${notification.service.url:http://localhost:3001}") String notificationUrl,
            @Value("${notification.service.internal-key:}") String internalKey) {
        this.notificationUrl = notificationUrl;
        this.internalKey = internalKey;
        this.restClient = RestClient.create();
    }

    @Async
    public void notificarCambioEstado(Orden orden, OrdenEstado nuevoEstado) {
        boolean esDeliveryNotificable = orden.getTipo() == OrdenTipo.DELIVERY && ESTADOS_NOTIFICABLES_DELIVERY.contains(nuevoEstado);
        boolean esRecojoNotificable = orden.getTipo() == OrdenTipo.RECOJO && ESTADOS_NOTIFICABLES_RECOJO.contains(nuevoEstado);

        if (!esDeliveryNotificable && !esRecojoNotificable) {
            return;
        }

        String telefono = orden.getTelefonoCliente();
        if (telefono == null || telefono.isBlank()) {
            log.debug("Orden #{} sin teléfono, omitiendo notificación WhatsApp", orden.getId());
            return;
        }

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("ordenId", orden.getId());
            body.put("numeroPedido", orden.getNumeroCliente());
            body.put("telefono", telefono);
            body.put("nombreCliente", orden.getNombreCliente() != null ? orden.getNombreCliente() : "Cliente");
            body.put("estadoNuevo", nuevoEstado.name());
            if (esRecojoNotificable && nuevoEstado.esListo()) {
                body.put("mensaje", mensajeRecojoListo(orden));
                body.put("plazoRecojoMinutos", PLAZO_RECOJO_MINUTOS);
            }

            restClient.post()
                    .uri(notificationUrl + "/api/notificaciones/whatsapp/estado")
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Key", internalKey)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            log.info("WhatsApp encolado — Orden #{} → {}", orden.getId(), nuevoEstado);
        } catch (Exception e) {
            log.warn("No se pudo encolar WhatsApp para orden #{}: {}", orden.getId(), e.getMessage());
        }
    }

    static final int PLAZO_RECOJO_MINUTOS = 60;

    /** Texto para el cliente de recojo cuando su pedido queda listo. */
    static String mensajeRecojoListo(Orden orden) {
        String numero = orden.getNumeroCliente() != null ? " #" + orden.getNumeroCliente() : "";
        return "Tu pedido" + numero + " está listo. Debes recogerlo en tienda dentro de 1 hora "
                + "presentando tu ticket con el código POL-" + orden.getId()
                + "; pasado ese plazo se declarará pedido fantasma. Escribe *ticket* para verlo de nuevo.";
    }

    /** Código de 4 dígitos para ver los pedidos sin iniciar sesión. */
    @Async
    public void enviarCodigoSeguimiento(String telefono, String codigo) {
        try {
            restClient.post()
                    .uri(notificationUrl + "/api/notificaciones/whatsapp/codigo")
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Key", internalKey)
                    .body(Map.of("telefono", telefono, "codigo", codigo))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Código de seguimiento encolado por WhatsApp");
        } catch (Exception e) {
            log.warn("No se pudo encolar el código de seguimiento: {}", e.getMessage());
        }
    }
}
