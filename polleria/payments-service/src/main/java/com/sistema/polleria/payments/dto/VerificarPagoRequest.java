package com.sistema.polleria.payments.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Decisión del administrador sobre un comprobante de Yape (T6c, S6).
 *
 * <p>El rechazo exige un motivo: el cliente lo recibe por WhatsApp (T6d) y el pedido queda
 * esperando un comprobante válido, así que sin motivo el aviso no tendría contenido. La validación
 * es declarativa ({@link AssertTrue}) para que el endpoint responda 400 antes de tocar el pago y
 * para que el contrato quede pegado al DTO.
 *
 * @param aprobado      {@code true} aprueba y avanza la orden; {@code false} rechaza la evidencia
 * @param motivoRechazo motivo obligatorio cuando {@code aprobado} es {@code false}
 */
public record VerificarPagoRequest(

    @NotNull(message = "aprobado requerido")
    Boolean aprobado,

    @Size(max = 300, message = "motivoRechazo no puede superar 300 caracteres")
    String motivoRechazo
) {

    /** Un rechazo sin motivo (o con motivo en blanco) es inválido. */
    @AssertTrue(message = "El motivo de rechazo es obligatorio cuando no se aprueba")
    public boolean isMotivoRechazoValido() {
        return !Boolean.FALSE.equals(aprobado)
                || (motivoRechazo != null && !motivoRechazo.isBlank());
    }
}
