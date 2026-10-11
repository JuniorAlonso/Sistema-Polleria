package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.MesaResponse;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.dto.event.ComandaCocinaEvent;
import com.sistema.polleria.orders.dto.event.ItemPedidoListoDto;
import com.sistema.polleria.orders.dto.event.PedidoListoCocinaEvent;
import com.sistema.polleria.orders.entity.Orden;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SalonEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void notificarPedidoListo(Orden orden) {
        try {
            Integer mesaNumero = orden.getMesa() != null ? orden.getMesa().getNumero() : null;
            List<ItemPedidoListoDto> items = orden.getItems().stream()
                    .map(item -> ItemPedidoListoDto.builder()
                            .nombre(item.getProducto() != null ? item.getProducto().getNombre() : "Producto")
                            .cantidad(item.getCantidad())
                            .notas(item.getNotas())
                            .build())
                    .toList();

            PedidoListoCocinaEvent event = PedidoListoCocinaEvent.builder()
                    .ordenId(orden.getId())
                    .mesaNumero(mesaNumero)
                    .mozoId(orden.getClienteId())
                    .mozoNombre(orden.getNombreCliente() != null ? orden.getNombreCliente() : "Mozo")
                    .items(items)
                    .build();

            messagingTemplate.convertAndSend("/topic/salon/pedidos-listos", event);
            log.info("WebSocket Event: /topic/salon/pedidos-listos para orden #{}", orden.getId());
        } catch (Exception e) {
            log.warn("Error al emitir evento STOMP de pedido listo: {}", e.getMessage());
        }
    }

    public void notificarNuevaComanda(Orden orden) {
        try {
            OrdenResponse response = OrdenResponse.from(orden);
            Integer mesaNumero = orden.getMesa() != null ? orden.getMesa().getNumero() : null;

            ComandaCocinaEvent event = ComandaCocinaEvent.builder()
                    .ordenId(orden.getId())
                    .tipo(orden.getTipo())
                    .mesaNumero(mesaNumero)
                    .nombreCliente(orden.getNombreCliente())
                    .observaciones(orden.getObservaciones())
                    .total(orden.getTotal())
                    .items(response.getItems())
                    .build();

            messagingTemplate.convertAndSend("/topic/cocina/nuevas-comandas", event);
            log.info("WebSocket Event: /topic/cocina/nuevas-comandas para orden #{}", orden.getId());
        } catch (Exception e) {
            log.warn("Error al emitir evento STOMP de nueva comanda: {}", e.getMessage());
        }
    }

    public void notificarMesaActualizada(MesaResponse mesa) {
        try {
            messagingTemplate.convertAndSend("/topic/salon/mesas", mesa);
            log.info("WebSocket Event: /topic/salon/mesas para mesa #{}", mesa.getNumero());
        } catch (Exception e) {
            log.warn("Error al emitir evento STOMP de mesa actualizada: {}", e.getMessage());
        }
    }
}
