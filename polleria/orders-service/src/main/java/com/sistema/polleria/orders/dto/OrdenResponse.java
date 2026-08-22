package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.*;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OrdenResponse {
    private Long id;
    private OrdenTipo tipo;
    private OrdenEstado estado;
    private Long clienteId;
    private Long mozoId;
    private Long repartidorId;
    private Integer mesaNumero;
    private String direccionEntrega;
    private String referencia;
    private String nombreCliente;
    private String telefonoCliente;
    private BigDecimal total;
    private String observaciones;
    private LocalDateTime creadoEn;
    private LocalDateTime actualizadoEn;
    private List<ItemResponse> items;

    @Data
    @Builder
    public static class ItemResponse {
        private Long productoId;
        private String productoNombre;
        private Integer cantidad;
        private BigDecimal precioUnitario;
        private BigDecimal subtotal;
        private String notas;
    }

    public static OrdenResponse from(Orden o) {
        List<ItemResponse> items = o.getItems().stream()
                .map(item -> ItemResponse.builder()
                        .productoId(item.getProducto().getId())
                        .productoNombre(item.getProducto().getNombre())
                        .cantidad(item.getCantidad())
                        .precioUnitario(item.getPrecioUnitario())
                        .subtotal(item.getSubtotal())
                        .notas(item.getNotas())
                        .build())
                .toList();

        return OrdenResponse.builder()
                .id(o.getId())
                .tipo(o.getTipo())
                .estado(o.getEstado())
                .clienteId(o.getClienteId())
                .mozoId(o.getMozoId())
                .repartidorId(o.getRepartidorId())
                .mesaNumero(o.getMesa() != null ? o.getMesa().getNumero() : null)
                .direccionEntrega(o.getDireccionEntrega())
                .referencia(o.getReferencia())
                .nombreCliente(o.getNombreCliente())
                .telefonoCliente(o.getTelefonoCliente())
                .total(o.getTotal())
                .observaciones(o.getObservaciones())
                .creadoEn(o.getCreadoEn())
                .actualizadoEn(o.getActualizadoEn())
                .items(items)
                .build();
    }
}
