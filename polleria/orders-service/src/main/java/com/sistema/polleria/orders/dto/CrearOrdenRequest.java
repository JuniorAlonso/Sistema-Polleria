package com.sistema.polleria.orders.dto;

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

    // Requerido para SALON
    private Long mesaId;

    // Requerido para DELIVERY
    private String direccionEntrega;
    private String referencia;

    // Datos del cliente (para delivery/recojo desde chatbot o web)
    private String nombreCliente;
    private String telefonoCliente;

    private String observaciones;

    @NotEmpty(message = "La orden debe tener al menos un producto")
    @Valid
    private List<OrdenItemRequest> items;
}
