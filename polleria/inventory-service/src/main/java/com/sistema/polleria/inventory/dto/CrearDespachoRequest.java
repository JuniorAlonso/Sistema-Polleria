package com.sistema.polleria.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrearDespachoRequest {

    private String solicitanteNombre;

    @NotEmpty(message = "El despacho debe contener al menos un insumo")
    @Valid
    private List<ItemDespachoRequest> items;
}
