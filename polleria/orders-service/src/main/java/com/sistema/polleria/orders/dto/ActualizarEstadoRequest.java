package com.sistema.polleria.orders.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.sistema.polleria.orders.entity.OrdenEstado;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ActualizarEstadoRequest {

    @JsonProperty("estado")
    @JsonAlias("nuevoEstado")
    @NotNull(message = "El estado es obligatorio")
    private OrdenEstado estado;

    private Long repartidorId;

    // Pickup ticket shown by the customer (POL-<order id>). Required to deliver a RECOJO order.
    private String codigoTicket;
}
