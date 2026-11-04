package com.sistema.polleria.payments.controller;

import com.sistema.polleria.payments.dto.CobroEfectivoRequest;
import com.sistema.polleria.payments.dto.ConfirmarPagoRequest;
import com.sistema.polleria.payments.dto.EfectivoPendienteResponse;
import com.sistema.polleria.payments.dto.IniciarPagoRequest;
import com.sistema.polleria.payments.dto.LiquidarEfectivoRequest;
import com.sistema.polleria.payments.dto.PagoResponse;
import com.sistema.polleria.payments.dto.VerificarPagoRequest;
import com.sistema.polleria.payments.dto.YapeOtpPagoRequest;
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
import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/pagos")
@RequiredArgsConstructor
public class PagoController {

    private final PagoService pagoService;
    private final FirmadorComprobantes firmadorComprobantes;

    /**
     * Iniciar pago — CLIENTE, MOZO, CAJERO (para delivery/recojo online y cobro en
     * caja)
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','CAJERO')")
    public PagoResponse iniciar(
            @Valid @RequestBody IniciarPagoRequest request,
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        Long clienteId = extractUserId(principal);
        return pagoService.iniciar(request, clienteId, authorization != null ? authorization : "");
    }

    /**
     * Crear Preferencia de Mercado Pago (Checkout Pro) — público como {@code /pagos/yape-otp}: el
     * checkout web deja pagar con tarjeta a invitados (T3/S1). El servicio valida la orden en
     * orders-service (PENDIENTE_PAGO y monto = total); un invitado queda como cliente anónimo.
     */
    @PostMapping("/mercadopago/preferencia")
    @ResponseStatus(HttpStatus.CREATED)
    public PreferenceResponse crearPreferenciaMercadoPago(
            @Valid @RequestBody IniciarPagoRequest request,
            Principal principal) {

        Long clienteId = extractUserId(principal);
        return pagoService.crearPreferenciaMercadoPago(request, clienteId);
    }

    /**
     * Pago directo en Checkout Web con Yape integrado en Mercado Pago (OTP 6 dígitos).
     * Si es aprobado, pasa la orden DIRECTO a preparación en cocina.
     */
    @PostMapping("/yape-otp")
    @ResponseStatus(HttpStatus.OK)
    public PagoResponse pagarConYapeOtp(
            @Valid @RequestBody YapeOtpPagoRequest request,
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        Long clienteId = extractUserId(principal);
        return pagoService.procesarYapeOtp(request, clienteId, authorization != null ? authorization : "");
    }

    /**
     * Cobro de efectivo en entrega (ContraPago).
     * Obligatorio para repartidores o cajero antes de permitir marcar ENTREGADO.
     */
    @PostMapping("/cobro-efectivo")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyAuthority('ADMIN','REPARTIDOR','CAJERO')")
    public PagoResponse registrarCobroEfectivo(
            @Valid @RequestBody CobroEfectivoRequest request,
            Principal principal,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorization) {

        Long operadorId = extractUserId(principal);
        Long repartidorId = tieneAutoridad(authentication, "REPARTIDOR") ? operadorId : null;
        return pagoService.procesarCobroEfectivo(request, operadorId, repartidorId,
                authorization != null ? authorization : "");
    }

    /**
     * Cash a courier collected and has not handed in yet (S6). ADMIN, CAJERO and the internal key see any
     * courier; a REPARTIDOR only his own id (403 otherwise). {@code desde} defaults to the beginning of time.
     */
    @GetMapping("/efectivo/repartidor/{repartidorId}")
    @PreAuthorize("hasAnyAuthority('ADMIN','CAJERO','REPARTIDOR','INTERNAL')")
    public EfectivoPendienteResponse efectivoPendiente(
            @PathVariable Long repartidorId,
            @RequestParam(value = "desde", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            java.time.LocalDateTime desde,
            Principal principal,
            Authentication authentication) {
        boolean soloPropio = tieneAutoridad(authentication, "REPARTIDOR")
                && !tieneAutoridad(authentication, "ADMIN") && !tieneAutoridad(authentication, "CAJERO")
                && !tieneAutoridad(authentication, "INTERNAL");
        if (soloPropio && !repartidorId.equals(extractUserId(principal))) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Un repartidor solo puede consultar su propio efectivo");
        }
        return pagoService.efectivoPendiente(repartidorId, desde);
    }

    /** Marks cash payments as handed in by a settlement (S6). Idempotent; 409 if claimed by another settlement. */
    @PostMapping("/efectivo/liquidar")
    @PreAuthorize("hasAnyAuthority('ADMIN','CAJERO','INTERNAL')")
    public java.util.Map<String, Object> liquidarEfectivo(@Valid @RequestBody LiquidarEfectivoRequest request) {
        int liquidados = pagoService.liquidarEfectivo(request.pagoIds(), request.liquidacionId());
        return java.util.Map.of("liquidacionId", request.liquidacionId(), "liquidados", liquidados);
    }

    /**
     * Registro interno de la evidencia de un pago por Yape hecho por WhatsApp (T6a,
     * S6).
     *
     * No lleva JWT: lo llama el notification-service con {@code X-Internal-Key}
     * (ver
     * {@code SecurityConfig#cadenaInterna}). Solo guarda la referencia opaca al
     * comprobante;
     * el archivo lo sube el notification-service (T6b) y lo verifica el admin
     * (T6c).
     */
    @PostMapping("/comprobante")
    public PagoResponse registrarComprobante(
            @Valid @RequestBody com.sistema.polleria.payments.dto.RegistrarComprobanteRequest request) {
        return pagoService.registrarComprobante(request);
    }

    /**
     * Subida web de la captura del pago (S3). El CLIENTE dueño de la orden o el personal
     * (ADMIN, CAJERO) envían la imagen como multipart ({@code file}); el pago queda en
     * {@code PENDIENTE_VERIFICACION}.
     */
    @PostMapping(value = "/orden/{ordenId}/comprobante", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('CLIENTE','ADMIN','CAJERO')")
    public PagoResponse subirComprobante(
            @PathVariable Long ordenId,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            Principal principal,
            Authentication authentication) {
        PagoResponse pago = pagoService.subirComprobanteWeb(
                ordenId, file, extractUserId(principal), puedeVerComprobante(authentication));
        return conComprobanteSegunRol(pago, authentication);
    }

    /**
     * Verificación del comprobante de Yape (S3). La ejecutan ADMIN y CAJERO. Aprobar avanza la
     * orden con el mismo mecanismo del pago aprobado de Mercado Pago y exige captura adjunta y
     * estar dentro de la ventana de 15 minutos (400 si no); rechazar exige {@code motivoRechazo}
     * y deja la orden impaga.
     *
     * <p>
     * Solo se puede verificar un comprobante en {@code PENDIENTE_VERIFICACION} (si
     * no, 409).
     */
    @PostMapping("/{id}/verificar")
    @PreAuthorize("hasAnyAuthority('ADMIN','ROLE_ADMIN','CAJERO')")
    public PagoResponse verificar(
            @PathVariable Long id,
            @Valid @RequestBody VerificarPagoRequest request,
            Principal principal,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String adminEmail = principal != null ? principal.getName() : null;
        return pagoService.verificar(id, request, adminEmail, authorization != null ? authorization : "");
    }
    // The verify response carries the proof only for staff; it is already limited to ADMIN/CAJERO.

    /** Detalle de un pago */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR','CAJERO')")
    public PagoResponse obtener(@PathVariable Long id, Authentication authentication) {
        return conComprobanteSegunRol(pagoService.obtener(id), authentication);
    }

    /** Pago asociado a una orden */
    @GetMapping("/orden/{ordenId}")
    @PreAuthorize("hasAnyAuthority('CLIENTE','MOZO','ADMIN','REPARTIDOR','CAJERO')")
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

    /**
     * Pagos — ADMIN / CAJERO. Con {@code ?estado=PENDIENTE_VERIFICACION} es la bandeja del cajero;
     * incluye la URL firmada de la captura para renderizarla.
     */
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','CAJERO')")
    public List<PagoResponse> todos(
            @RequestParam(value = "estado", required = false) com.sistema.polleria.payments.entity.EstadoPago estado,
            Authentication authentication) {
        return pagoService.todos(estado).stream()
                .map(pago -> conComprobanteSegunRol(pago, authentication))
                .toList();
    }

    /**
     * Confirmar pago manualmente o vía webhook de la pasarela.
     * Protegido con JWT; el endpoint webhook (/pagos/webhook/**) es público
     * y debe validar un HMAC-secret propio de la pasarela (implementación futura).
     */
    @PatchMapping("/{id}/confirmar")
    @PreAuthorize("hasAnyAuthority('ADMIN','REPARTIDOR','CAJERO')")
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
     * El comprobante de Yape solo lo puede ver un ADMIN (T6c, S7): para él se firma
     * una URL de vida
     * corta; cualquier otro rol recibe la respuesta sin la clave del objeto ni la
     * URL, porque el
     * bucket se mantiene privado. Los pagos sin comprobante no cambian.
     */
    private PagoResponse conComprobanteSegunRol(PagoResponse pago, Authentication authentication) {
        if (!puedeVerComprobante(authentication) || pago.comprobanteClave() == null) {
            return pago.sinComprobante();
        }
        return pago.conUrlComprobante(firmadorComprobantes.urlFirmada(pago.comprobanteClave()));
    }

    /**
     * Igual que {@link #conComprobanteSegunRol} pero sin firmar URL: para las
     * respuestas de cambio
     * de estado solo hace falta que un rol distinto de {@code ADMIN} no reciba la
     * clave del objeto.
     */
    private PagoResponse soloAdminVeElComprobante(PagoResponse pago, Authentication authentication) {
        return puedeVerComprobante(authentication) ? pago : pago.sinComprobante();
    }

    /** ADMIN and CAJERO (who verify the capture) are the only roles that see the proof. */
    private boolean puedeVerComprobante(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(a -> "ADMIN".equals(a.getAuthority()) || "ROLE_ADMIN".equals(a.getAuthority())
                        || "CAJERO".equals(a.getAuthority()) || "ROLE_CAJERO".equals(a.getAuthority()));
    }

    private boolean tieneAutoridad(Authentication authentication, String rol) {
        return authentication != null && authentication.getAuthorities() != null
                && authentication.getAuthorities().stream()
                        .anyMatch(a -> rol.equals(a.getAuthority()) || ("ROLE_" + rol).equals(a.getAuthority()));
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id)
                return id;
            if (creds instanceof Integer id)
                return id.longValue();
        }
        return 0L;
    }
}
