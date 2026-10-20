package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.VerificarPagoRequest;
import com.sistema.polleria.payments.service.FirmadorComprobantes;
import com.sistema.polleria.payments.service.PagoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.sistema.polleria.payments.dto.PreferenceResponse;
import com.sistema.polleria.payments.gateway.MercadoPagoGateway;
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;
    private final MercadoPagoGateway mercadoPagoGateway;
    private final FirmadorComprobantes firmadorComprobantes;

    /** Iniciar pago — CLIENTE, MOZO (para delivery/recojo online) */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN')")
    public PagoResponse iniciar(
            @Valid @RequestBody IniciarPagoRequest request,
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        Long clienteId = extractUserId(principal);
        return pagoService.iniciar(request, clienteId, authorization != null ? authorization : "");
    }

    /** Crear Preferencia de Mercado Pago (Checkout Pro) — requiere usuario autenticado */
    @PostMapping("/mercadopago/preferencia")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN')")
    public PreferenceResponse crearPreferenciaMercadoPago(
            @Valid @RequestBody IniciarPagoRequest request,
            Principal principal) {

        Long clienteId = extractUserId(principal);
        return mercadoPagoGateway.crearPreferencia(request, clienteId);
    }



    /**
     * Registro interno de la evidencia de un pago por Yape hecho por WhatsApp (T6a, S6).
     *
     * No lleva JWT: lo llama el notification-service con {@code X-Internal-Key} (ver
     * {@code SecurityConfig#cadenaInterna}). Solo guarda la referencia opaca al comprobante;
     * el archivo lo sube el notification-service (T6b) y lo verifica el admin (T6c).
     */
    @PostMapping("/comprobante")
    public PagoResponse registrarComprobante(
            @Valid @RequestBody com.sistema.polleria.payments.dto.RegistrarComprobanteRequest request) {
        return pagoService.registrarComprobante(request);
    }

    /**
     * Verificación del comprobante de Yape (T6c, S6). **Exclusiva de ADMIN**: el rol {@code CAJERO}
     * no se toca. Aprobar avanza la orden con el mismo mecanismo del pago aprobado de Mercado Pago;
     * rechazar exige {@code motivoRechazo} y deja la orden impaga.
     *
     * <p>Solo se puede verificar un comprobante en {@code PENDIENTE_VERIFICACION} (si no, 409).
     */
    @PostMapping("/{id}/verificar")
    @PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN')")
    public PagoResponse verificar(
            @PathVariable Long id,
            @Valid @RequestBody VerificarPagoRequest request,
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String adminEmail = principal != null ? principal.getName() : null;
        return pagoService.verificar(id, request, adminEmail, authorization != null ? authorization : "");
    }

    /** Detalle de un pago */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR')")
    public PagoResponse obtener(@PathVariable Long id, Authentication authentication) {
        return conComprobanteSegunRol(pagoService.obtener(id), authentication);
    }

    /** Pago asociado a una orden */
    @GetMapping("/orden/{ordenId}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR')")
    public PagoResponse porOrden(@PathVariable Long ordenId, Authentication authentication) {
        return conComprobanteSegunRol(pagoService.obtenerPorOrden(ordenId), authentication);
    }

    /** Mis pagos — historial del cliente autenticado */
    @GetMapping("/mis-pagos")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO')")
    public List<PagoResponse> misPagos(Principal principal, Authentication authentication) {
        return pagoService.misOrdenes(extractUserId(principal)).stream()
                .map(pago -> conComprobanteSegunRol(pago, authentication))
                .toList();
    }

    /** Todos los pagos — solo ADMIN / finanzas */
    @GetMapping
    @PreAuthorize("hasAuthority('ADMIN')")
    public List<PagoResponse> todos() {
        return pagoService.todos();
    }

    /**
     * Confirmar pago manualmente o vía webhook de la pasarela.
     * Protegido con JWT; el endpoint webhook (/pagos/webhook/**) es público
     * y debe validar un HMAC-secret propio de la pasarela (implementación futura).
     */
    @PatchMapping("/{id}/confirmar")
    @PreAuthorize("hasAnyAuthority('ADMIN','REPARTIDOR')")
    public PagoResponse confirmar(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmarPagoRequest req,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return soloAdminVeElComprobante(
                pagoService.confirmar(id, req, authorization != null ? authorization : ""),
                authentication);
    }

    /** Cancelar pago */
    @PatchMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyAuthority('ADMIN','CLIENTE')")
    public PagoResponse cancelar(@PathVariable Long id, Authentication authentication) {
        return soloAdminVeElComprobante(pagoService.cancelar(id), authentication);
    }

    /** Reembolsar pago — solo ADMIN o microservicios autorizados */
    @PostMapping("/{id}/reembolso")
    @PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN')")
    public PagoResponse reembolsar(
            @PathVariable Long id,
            @RequestBody(required = false) com.sistema.polleria.payments.dto.ReembolsoRequest request) {
        java.math.BigDecimal monto = request != null ? request.monto() : null;
        String motivo = request != null ? request.motivo() : null;
        return pagoService.reembolsar(id, monto, motivo);
    }

    /** Reembolsar pago por orden ID */
    @PostMapping("/orden/{ordenId}/reembolso")
    @PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN')")
    public PagoResponse reembolsarPorOrden(
            @PathVariable Long ordenId,
            @RequestBody(required = false) com.sistema.polleria.payments.dto.ReembolsoRequest request) {
        java.math.BigDecimal monto = request != null ? request.monto() : null;
        String motivo = request != null ? request.motivo() : null;
        return pagoService.reembolsarPorOrden(ordenId, monto, motivo);
    }

    // ─── util ────────────────────────────────────────────────────────

    /**
     * El comprobante de Yape solo lo puede ver un ADMIN (T6c, S7): para él se firma una URL de vida
     * corta; cualquier otro rol recibe la respuesta sin la clave del objeto ni la URL, porque el
     * bucket se mantiene privado. Los pagos sin comprobante no cambian.
     */
    private PagoResponse conComprobanteSegunRol(PagoResponse pago, Authentication authentication) {
        if (!esAdmin(authentication) || pago.comprobanteClave() == null) {
            return pago.sinComprobante();
        }
        return pago.conUrlComprobante(firmadorComprobantes.urlFirmada(pago.comprobanteClave()));
    }

    /**
     * Igual que {@link #conComprobanteSegunRol} pero sin firmar URL: para las respuestas de cambio
     * de estado solo hace falta que un rol distinto de {@code ADMIN} no reciba la clave del objeto.
     */
    private PagoResponse soloAdminVeElComprobante(PagoResponse pago, Authentication authentication) {
        return esAdmin(authentication) ? pago : pago.sinComprobante();
    }

    private boolean esAdmin(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority()));
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 0L;
    }
}
