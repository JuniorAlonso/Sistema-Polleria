package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.CanalOrigen;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class CrearOrdenRequest {

    @NotNull(message = "El tipo de orden es obligatorio")
    private OrdenTipo tipo;

    // Canal por el que entró el pedido (S1). Opcional a propósito: el checkout web no lo manda
    // y OrdenService deriva WEB (o SALON para las comandas de salón). El bot manda WHATSAPP.
    private CanalOrigen canalOrigen;

    // Requerido para SALON
    private Long mesaId;

    // Requerido para DELIVERY
    private String direccionEntrega;
    private String referencia;

    // Datos del cliente (para delivery/recojo desde chatbot o web)
    private String nombreCliente;
    private String telefonoCliente;

    private String observaciones;

    // Campos operativos opcionales (ContraPago / WhatsApp / Auditoría)
    private OrdenEstado estadoInicial;
    private java.math.BigDecimal montoPagaCon;
    private String ipOrigen;

    @NotEmpty(message = "La orden debe tener al menos un producto")
    @Valid
    private List<OrdenItemRequest> items;
}
