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
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SancionService {

    private final SancionClienteRepository sancionClienteRepository;
    private final UserRepository userRepository;

    /**
     * Registers a permanent sanction (no expiry). If a sanction already exists for the same normalized
     * phone, e-mail (case-insensitive) or IP, it is merged into the oldest one instead of duplicated:
     * missing identifiers are filled in and the blocking flags are OR-ed, never lowered.
     */
    @Transactional
    public SancionCliente registrarSancion(CrearSancionRequest req, String creadoPor) {
        String telefonoNorm = TelefonoUtil.canonico(req.telefono());
        String emailNorm = normalizarEmail(req.email());
        String ipLimpia = (req.ipAddress() != null && !req.ipAddress().isBlank()) ? req.ipAddress().trim() : null;
        boolean efectivo = req.bloqueadoEfectivo() != null ? req.bloqueadoEfectivo() : true;
        boolean total = req.bloqueadoTotal() != null ? req.bloqueadoTotal() : false;

        log.warn("Registrando sanción permanente — Tel: {} (norm: {}), Email: {}, IP: {}, Motivo: {}",
                req.telefono(), telefonoNorm, emailNorm, ipLimpia, req.motivo());

        List<SancionCliente> existentes = sancionClienteRepository.buscarCoincidencias(telefonoNorm, emailNorm, ipLimpia);
        SancionCliente sancion;
        if (existentes.isEmpty()) {
            sancion = SancionCliente.builder()
                    .telefono(req.telefono())
                    .telefonoNormalizado(telefonoNorm)
                    .email(emailNorm)
                    .ipAddress(ipLimpia)
                    .motivo(req.motivo())
                    .ordenId(req.ordenId())
                    .bloqueadoEfectivo(efectivo)
                    .bloqueadoTotal(total)
                    .creadoEn(LocalDateTime.now())
                    .creadoPor(creadoPor != null ? creadoPor : "SISTEMA_PEDIDO_FANTASMA")
                    .build();
        } else {
            sancion = existentes.get(0);
            if (sancion.getTelefonoNormalizado() == null && telefonoNorm != null) {
                sancion.setTelefono(req.telefono());
                sancion.setTelefonoNormalizado(telefonoNorm);
            }
            if (sancion.getEmail() == null && emailNorm != null) sancion.setEmail(emailNorm);
            if (sancion.getIpAddress() == null && ipLimpia != null) sancion.setIpAddress(ipLimpia);
            sancion.setBloqueadoEfectivo(sancion.isBloqueadoEfectivo() || efectivo);
            sancion.setBloqueadoTotal(sancion.isBloqueadoTotal() || total);
            log.info("Sanción existente #{} actualizada (fusión, sin duplicar)", sancion.getId());
        }

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
        String emailNorm = normalizarEmail(email);
        String ipLimpia = (ip != null && !ip.isBlank()) ? ip.trim() : null;

        if (telefonoNorm == null && emailNorm == null && ipLimpia == null) {
            return VerificarSancionResponse.sinSancion();
        }

        List<SancionCliente> coincidencias = sancionClienteRepository.buscarCoincidencias(telefonoNorm, emailNorm, ipLimpia);
        if (coincidencias.isEmpty()) {
            return VerificarSancionResponse.sinSancion();
        }

        // Any matching row blocks: the flags are the OR of every match (merged or legacy duplicates).
        boolean efectivo = coincidencias.stream().anyMatch(SancionCliente::isBloqueadoEfectivo);
        boolean total = coincidencias.stream().anyMatch(SancionCliente::isBloqueadoTotal);
        log.info("Sanción activa detectada ({} coincidencias) — efectivo={}, total={}", coincidencias.size(), efectivo, total);
        return new VerificarSancionResponse(true, efectivo, total);
    }

    private static String normalizarEmail(String email) {
        return (email != null && !email.isBlank()) ? email.trim().toLowerCase() : null;
    }
}
