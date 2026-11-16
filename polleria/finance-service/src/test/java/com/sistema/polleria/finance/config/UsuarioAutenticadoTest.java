package com.sistema.polleria.finance.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UsuarioAutenticadoTest {

    private static UsernamePasswordAuthenticationToken token(Object credentials) {
        return new UsernamePasswordAuthenticationToken("cajero@x.pe", credentials,
                List.of(new SimpleGrantedAuthority("CAJERO")));
    }

    @Test
    void devuelveElIdDelToken() {
        assertThat(UsuarioAutenticado.id(token(7L))).isEqualTo(7L);
    }

    @Test
    void sinIdEnElTokenRechazaEnVezDeActuarComoElUsuarioUno() {
        assertThatThrownBy(() -> UsuarioAutenticado.id(token(null))).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> UsuarioAutenticado.id(null)).isInstanceOf(AccessDeniedException.class);
    }
}
