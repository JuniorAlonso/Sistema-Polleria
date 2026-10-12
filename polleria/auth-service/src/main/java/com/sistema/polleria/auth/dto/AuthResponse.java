package com.sistema.polleria.auth.dto;

import com.sistema.polleria.auth.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String refreshToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long expiresIn;
    private String name;
    private String email;
    private String phone;
    private Role role;
    private boolean requiresTwoFactor;
    private String message;
}
