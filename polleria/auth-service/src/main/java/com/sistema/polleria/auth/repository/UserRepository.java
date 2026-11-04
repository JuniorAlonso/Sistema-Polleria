package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.Role;
import com.sistema.polleria.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);

    /** Motorizados que se pueden asignar a un pedido (RF18): un usuario dado de baja no se ofrece. */
    List<User> findByRoleAndActiveTrueOrderByNameAsc(Role role);
}
