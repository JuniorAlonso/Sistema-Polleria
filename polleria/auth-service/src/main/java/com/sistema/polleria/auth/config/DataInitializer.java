package com.sistema.polleria.auth.config;

import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public CommandLineRunner initDefaultUsers() {
        return args -> {
            log.info("Verificando existencia de usuarios iniciales con buzón Yopmail...");

            List<SeedUser> defaultUsers = List.of(
                    new SeedUser("Administrador General", "admin.polleria@yopmail.com", "990000001", "Password123!", Role.ADMIN),
                    new SeedUser("Mozo Principal", "mozo.polleria@yopmail.com", "990000002", "Password123!", Role.MOZO),
                    new SeedUser("Jefe de Cocina", "cocina.polleria@yopmail.com", "990000003", "Password123!", Role.COCINA),
                    new SeedUser("Repartidor Motorizado", "repartidor.polleria@yopmail.com", "990000004", "Password123!", Role.REPARTIDOR),
                    new SeedUser("Cajero de Turno", "cajero.polleria@yopmail.com", "990000006", "Password123!", Role.CAJERO),
                    new SeedUser("Cliente Frecuente", "cliente.polleria@yopmail.com", "990000005", "Password123!", Role.CLIENTE)
            );

            for (SeedUser seed : defaultUsers) {
                if (!userRepository.existsByEmail(seed.email())) {
                    User user = User.builder()
                            .name(seed.name())
                            .email(seed.email())
                            .phone(seed.phone())
                            .password(passwordEncoder.encode(seed.password()))
                            .role(seed.role())
                            .active(true)
                            .build();

                    userRepository.save(user);
                    log.info("Usuario seed creado: {} ({}) - Rol: {}", seed.email(), seed.name(), seed.role());
                } else {
                    log.debug("Usuario {} ya existe en base de datos.", seed.email());
                }
            }

            log.info("Inicialización de usuarios con Yopmail completada exitosamente.");
        };
    }

    private record SeedUser(String name, String email, String phone, String password, Role role) {}
}
