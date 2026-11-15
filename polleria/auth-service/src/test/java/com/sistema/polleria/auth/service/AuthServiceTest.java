package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.AuthResponse;
import com.sistema.polleria.auth.dto.CreateStaffRequest;
import com.sistema.polleria.auth.dto.LoginRequest;
import com.sistema.polleria.auth.dto.RegisterRequest;
import com.sistema.polleria.auth.entity.RefreshToken;
import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private IpBlacklistService ipBlacklistService;
    @Mock private TwoFactorService twoFactorService;
    @Mock private RefreshTokenService refreshTokenService;

    @InjectMocks
    private AuthService authService;

    @Test
    void registroPublicoSiempreAsignaRolCliente() {
        RegisterRequest req = new RegisterRequest();
        req.setName("Juan Perez");
        req.setEmail("Juan@Example.com");
        req.setPhone("987654321");
        req.setPassword("Pass123");

        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(userRepository.existsByPhone("987654321")).thenReturn(false);
        when(passwordEncoder.encode("Pass123")).thenReturn("encoded");
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt-token");
        when(jwtService.getExpirationMs()).thenReturn(900_000L);
        when(refreshTokenService.createRefreshToken(any(User.class)))
                .thenReturn(RefreshToken.builder().token("refresh-token").build());

        AuthResponse response = authService.register(req);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals(Role.CLIENTE, userCaptor.getValue().getRole());
        assertEquals(Role.CLIENTE, response.getRole());
        assertEquals("juan@example.com", userCaptor.getValue().getEmail());
    }

    @Test
    void registerStaffPermiteAsignarRolPersonal() {
        CreateStaffRequest req = new CreateStaffRequest();
        req.setName("Admin Nuevo");
        req.setEmail("admin.nuevo@example.com");
        req.setPassword("Pass123");
        req.setRole(Role.CAJERO);

        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(passwordEncoder.encode("Pass123")).thenReturn("encoded");

        AuthResponse response = authService.registerStaff(req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals(Role.CAJERO, captor.getValue().getRole());
        assertEquals(Role.CAJERO, response.getRole());
        assertNull(response.getToken());
    }

    @Test
    void loginNoConfiaEnXForwardedForPorDefecto() {
        HttpServletRequest httpReq = mock(HttpServletRequest.class);
        when(httpReq.getRemoteAddr()).thenReturn("10.0.0.5");

        LoginRequest loginReq = new LoginRequest();
        loginReq.setIdentifier("cliente@example.com");
        loginReq.setPassword("Pass123");

        User cliente = User.builder()
                .id(1L).name("Cliente").email("cliente@example.com")
                .password("encoded").role(Role.CLIENTE).active(true).build();
        when(ipBlacklistService.isBlocked("10.0.0.5")).thenReturn(false);
        when(userRepository.findByEmail("cliente@example.com")).thenReturn(Optional.of(cliente));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(null);
        when(jwtService.generateToken(cliente)).thenReturn("jwt");
        when(jwtService.getExpirationMs()).thenReturn(900_000L);
        when(refreshTokenService.createRefreshToken(cliente))
                .thenReturn(RefreshToken.builder().token("ref").build());

        authService.login(loginReq, httpReq);

        verify(httpReq, never()).getHeader("X-Forwarded-For");
        verify(ipBlacklistService).isBlocked("10.0.0.5");
        verify(ipBlacklistService).resetFailedAttempts("10.0.0.5");
    }
}
