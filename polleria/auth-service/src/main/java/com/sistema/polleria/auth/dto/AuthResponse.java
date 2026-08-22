package com.sistema.polleria.auth.dto;

import com.sistema.polleria.auth.entity.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {
    private String token;
    private String name;
    private String email;
    private Role role;
    private boolean requiresTwoFactor;
    private String message;
}
