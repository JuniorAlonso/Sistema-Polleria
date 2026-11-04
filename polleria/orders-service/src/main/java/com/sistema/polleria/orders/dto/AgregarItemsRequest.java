package com.sistema.polleria.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * Segunda ronda sobre una comanda de salón ya abierta ({@code POST /ordenes/{id}/items}).
 * Mismo patrón de validación que {@link CrearOrdenRequest}: al menos un producto y cada ítem
 * validado.
 */
@Data
public class AgregarItemsRequest {

    @NotEmpty(message = "La comanda debe tener al menos un producto")
    @Valid
    private List<OrdenItemRequest> items;
}
