package com.sistema.polleria.auth.service;

import com.sistema.polleria.auth.dto.CrearSancionRequest;
import com.sistema.polleria.auth.dto.VerificarSancionResponse;
import com.sistema.polleria.auth.entity.SancionCliente;
import com.sistema.polleria.auth.entity.User;
import com.sistema.polleria.auth.repository.SancionClienteRepository;
import com.sistema.polleria.auth.repository.UserRepository;
import com.sistema.polleria.auth.util.TelefonoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SancionService {

    private final SancionClienteRepository sancionClienteRepository;
    private final UserRepository userRepository;

    @Transactional
    public SancionCliente registrarSancion(CrearSancionRequest req, String creadoPor) {
        String telefonoNorm = TelefonoUtil.canonico(req.telefono());

        log.warn("Registrando sanción permanente — Tel: {} (norm: {}), Email: {}, IP: {}, Motivo: {}",
                req.telefono(), telefonoNorm, req.email(), req.ipAddress(), req.motivo());

        SancionCliente sancion = SancionCliente.builder()
                .telefono(req.telefono())
                .telefonoNormalizado(telefonoNorm)
                .email(req.email() != null ? req.email().trim().toLowerCase() : null)
                .ipAddress(req.ipAddress())
                .motivo(req.motivo())
                .ordenId(req.ordenId())
                .bloqueadoEfectivo(req.bloqueadoEfectivo() != null ? req.bloqueadoEfectivo() : true)
                .bloqueadoTotal(req.bloqueadoTotal() != null ? req.bloqueadoTotal() : false)
                .creadoEn(LocalDateTime.now())
                .creadoPor(creadoPor != null ? creadoPor : "SISTEMA_PEDIDO_FANTASMA")
                .build();

        sancion = sancionClienteRepository.save(sancion);

        // Si se pide bloqueo total o existe el usuario registrado, desactivar la cuenta
        if (sancion.isBloqueadoTotal()) {
            if (sancion.getEmail() != null) {
                userRepository.findByEmail(sancion.getEmail()).ifPresent(u -> {
                    u.setActive(false);
                    userRepository.save(u);
                    log.warn("Cuenta de usuario ID #{} desactivada por sanción total", u.getId());
                });
            }
            if (telefonoNorm != null) {
                userRepository.findByPhone(telefonoNorm).ifPresent(u -> {
                    u.setActive(false);
                    userRepository.save(u);
                    log.warn("Cuenta de usuario ID #{} desactivada por sanción total (teléfono)", u.getId());
                });
            }
        }

        return sancion;
    }

    @Transactional(readOnly = true)
    public VerificarSancionResponse verificarSancion(String telefono, String email, String ip) {
        String telefonoNorm = TelefonoUtil.canonico(telefono);
        String emailNorm = (email != null && !email.isBlank()) ? email.trim().toLowerCase() : null;
        String ipLimpia = (ip != null && !ip.isBlank()) ? ip.trim() : null;

        Optional<SancionCliente> optSancion = sancionClienteRepository.buscarSancionActiva(telefonoNorm, emailNorm, ipLimpia);
        if (optSancion.isEmpty()) {
            return VerificarSancionResponse.sinSancion(telefonoNorm);
        }

        SancionCliente s = optSancion.get();
        log.info("Sanción activa detectada para cliente (Tel: {}, Email: {}, IP: {}) — Motivo: {}",
                telefonoNorm, emailNorm, ipLimpia, s.getMotivo());

        return new VerificarSancionResponse(
                true,
                s.isBloqueadoEfectivo(),
                s.isBloqueadoTotal(),
                s.getMotivo(),
                telefonoNorm
        );
    }
}
