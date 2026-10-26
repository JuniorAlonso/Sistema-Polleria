package com.sistema.polleria.auth.repository;

import com.sistema.polleria.auth.entity.SancionCliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SancionClienteRepository extends JpaRepository<SancionCliente, Long> {

    @Query("SELECT s FROM SancionCliente s WHERE " +
           "(:telefonoNorm IS NOT NULL AND s.telefonoNormalizado = :telefonoNorm) OR " +
           "(:email IS NOT NULL AND LOWER(s.email) = LOWER(:email)) OR " +
           "(:ip IS NOT NULL AND s.ipAddress = :ip) ORDER BY s.creadoEn DESC LIMIT 1")
    Optional<SancionCliente> buscarSancionActiva(
            @Param("telefonoNorm") String telefonoNorm,
            @Param("email") String email,
            @Param("ip") String ip);

    @Query("SELECT COUNT(s) > 0 FROM SancionCliente s WHERE " +
           "(:telefonoNorm IS NOT NULL AND s.telefonoNormalizado = :telefonoNorm) OR " +
           "(:email IS NOT NULL AND LOWER(s.email) = LOWER(:email)) OR " +
           "(:ip IS NOT NULL AND s.ipAddress = :ip)")
    boolean existeSancion(
            @Param("telefonoNorm") String telefonoNorm,
            @Param("email") String email,
            @Param("ip") String ip);
}
