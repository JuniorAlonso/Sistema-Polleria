package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.service.PagoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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

    /** Crear Preferencia de Mercado Pago (Checkout Pro) */
    @PostMapping("/mercadopago/preferencia")
    @ResponseStatus(HttpStatus.CREATED)
    public PreferenceResponse crearPreferenciaMercadoPago(
            @Valid @RequestBody IniciarPagoRequest request,
            Principal principal) {

        Long clienteId = extractUserId(principal);
        return mercadoPagoGateway.crearPreferencia(request, clienteId);
    }



    /** Detalle de un pago */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR')")
    public PagoResponse obtener(@PathVariable Long id) {
        return pagoService.obtener(id);
    }

    /** Pago asociado a una orden */
    @GetMapping("/orden/{ordenId}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR')")
    public PagoResponse porOrden(@PathVariable Long ordenId) {
        return pagoService.obtenerPorOrden(ordenId);
    }

    /** Mis pagos — historial del cliente autenticado */
    @GetMapping("/mis-pagos")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO')")
    public List<PagoResponse> misPagos(Principal principal) {
        return pagoService.misOrdenes(extractUserId(principal));
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
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return pagoService.confirmar(id, req, authorization != null ? authorization : "");
    }

    /** Cancelar pago */
    @PatchMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyAuthority('ADMIN','CLIENTE')")
    public PagoResponse cancelar(@PathVariable Long id) {
        return pagoService.cancelar(id);
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

    private Long extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 0L;
    }
}
