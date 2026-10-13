package com.sistema.polleria.auth.dto;

import com.sistema.polleria.auth.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Motorizado asignable a un pedido de delivery (RF18).
 *
 * Expone solo lo que el panel necesita para elegir a quién mandar: quién es y cómo contactarlo.
 * Nunca la contraseña (ni su hash) ni el rol: el listado es de personas, no de credenciales.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RepartidorResponse {
    private Long id;
    private String nombre;
    private String email;
    private String telefono;

    public static RepartidorResponse from(User user) {
        if (user == null) {
            return null;
        }
        return RepartidorResponse.builder()
                .id(user.getId())
                .nombre(user.getName())
                .email(user.getEmail())
                .telefono(user.getPhone())
                .build();
    }
}
