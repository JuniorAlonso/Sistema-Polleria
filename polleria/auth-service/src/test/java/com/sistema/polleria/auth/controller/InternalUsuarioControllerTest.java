package com.sistema.polleria.auth.controller;

import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InternalUsuarioControllerTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final InternalUsuarioController controller = new InternalUsuarioController(repo);

    InternalUsuarioControllerTest() {
        ReflectionTestUtils.setField(controller, "internalApiKey", "secret");
    }

    @Test
    void sinClaveInternaDevuelve403() {
        assertEquals(HttpStatus.FORBIDDEN, controller.emailDeUsuario(1L, null).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, controller.emailDeUsuario(1L, "wrong").getStatusCode());
    }

    @Test
    void conClaveInternaDevuelveElEmail() {
        User u = new User();
        u.setEmail("cliente@test.com");
        when(repo.findById(1L)).thenReturn(Optional.of(u));

        var res = controller.emailDeUsuario(1L, "secret");

        assertEquals(HttpStatus.OK, res.getStatusCode());
        assertEquals("cliente@test.com", res.getBody().get("email"));
        assertEquals(HttpStatus.NOT_FOUND, controller.emailDeUsuario(2L, "secret").getStatusCode());
    }
}
