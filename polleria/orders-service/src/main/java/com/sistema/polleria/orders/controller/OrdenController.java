package com.sistema.polleria.orders.controller;

import com.sistema.polleria.orders.dto.ActualizarEstadoRequest;
import com.sistema.polleria.orders.dto.AgregarItemsRequest;
import com.sistema.polleria.orders.dto.CrearOrdenRequest;
import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import com.sistema.polleria.orders.service.OrdenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Principal;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

@RestController
@RequestMapping("/ordenes")
@RequiredArgsConstructor
public class OrdenController {

    private static final Set<String> ROLES_PERSONAL = Set.of("ADMIN", "MOZO", "COCINA", "REPARTIDOR", "CAJERO");

    private final OrdenService ordenService;

    // Clave compartida con otros microservicios (p. ej. payments-service) para leer órdenes sin JWT
    @Value("${internal.api-key:}")
    private String internalApiKey;

    @PostMapping
    public ResponseEntity<OrdenResponse> crear(
            @Valid @RequestBody CrearOrdenRequest request,
            Authentication authentication,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna
    ) {
        // El checkout público es DELIVERY/RECOJO: un invitado debe poder pedir. La comanda de
        // salón, en cambio, la toma el personal de la pollería (mozo o administrador) o un
        // microservicio con la clave interna; si no, cualquiera ocuparía una mesa.
        if (request.getTipo() == OrdenTipo.SALON && !esLlamadaInterna(claveInterna)
                && !esPersonal(authentication)) {
            throw new AccessDeniedException(
                    "La comanda de salón la toma el personal de la pollería (mozo o administrador).");
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ordenService.crear(request, extraerUserId(authentication)));
    }

    /**
     * S3.1: el mozo confirma que ya entregó el pedido en mesa. No cambia el estado de la orden ni
     * libera la mesa: eso ocurre al cobrar.
     */
    @PostMapping("/{id}/servir")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO')")
    public ResponseEntity<OrdenResponse> marcarServido(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ordenService.marcarServido(id, extraerUserId(authentication)));
    }

    /**
     * Segunda ronda sobre la comanda de salón: reutiliza la misma orden en lugar de abrir otra.
     * Solo ADMIN/MOZO: es la operación de mozo/administrador en el salón.
     */
    @PostMapping("/{id}/items")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO')")
    public ResponseEntity<OrdenResponse> agregarItems(
            @PathVariable Long id,
            @Valid @RequestBody AgregarItemsRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                ordenService.agregarItems(id, request.getItems(), extraerUserId(authentication)));
    }

    /**
     * Un pedido solo lo ve su dueño, el personal o un microservicio con la clave interna.
     * A cualquier otro se le responde 404 para no revelar qué pedidos existen.
     */
    @GetMapping("/{id}")
    public ResponseEntity<OrdenResponse> obtener(
            @PathVariable Long id,
            Authentication authentication,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna
    ) {
        OrdenResponse orden = ordenService.obtener(id);
        if (esLlamadaInterna(claveInterna) || esPersonal(authentication) || esDueno(authentication, orden)) {
            return ResponseEntity.ok(orden);
        }
        throw new NoSuchElementException("Orden no encontrada: " + id);
    }

    @GetMapping("/cocina")
    @PreAuthorize("hasAnyAuthority('ADMIN','COCINA')")
    public ResponseEntity<List<OrdenResponse>> listarParaCocina() {
        return ResponseEntity.ok(ordenService.listarParaCocina());
    }

    @GetMapping("/activos")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO')")
    public ResponseEntity<List<OrdenResponse>> listarActivos() {
        return ResponseEntity.ok(ordenService.listarActivos());
    }

    @GetMapping("/mis-ordenes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<OrdenResponse>> misOrdenes(Principal principal) {
        Long userId = extraerUserId(principal);
        if (userId <= 0) {
            return ResponseEntity.ok(List.of());
        }
        return ResponseEntity.ok(ordenService.listarPorCliente(userId));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO','COCINA','REPARTIDOR','CAJERO')")
    public ResponseEntity<List<OrdenResponse>> listar(
            @RequestParam(required = false) OrdenEstado estado,
            @RequestParam(required = false, defaultValue = "false") boolean soloActivos
    ) {
        if (estado != null) {
            return ResponseEntity.ok(ordenService.listarPorEstado(estado));
        }
        if (soloActivos) {
            return ResponseEntity.ok(ordenService.listarActivos());
        }
        return ResponseEntity.ok(ordenService.listarActivosYCompletadosHoy());
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyAuthority('ADMIN','MOZO','COCINA','REPARTIDOR','CLIENTE')")
    public ResponseEntity<OrdenResponse> actualizarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarEstadoRequest request,
            Authentication authentication,
            @RequestHeader(value = "X-Internal-Key", required = false) String claveInterna
    ) {
        // Un cliente solo puede mover SU pedido (p. ej. cancelarlo). El personal, el dueño del
        // pedido o un microservicio con la clave interna sí pueden. Sin esta guarda, cualquier
        // CLIENTE autenticado podía cancelar o entregar el pedido de otro cliente.
        // Se responde 404, igual que obtener(): distinguir "existe pero no es tuyo" de "no existe"
        // permitiría enumerar los pedidos de la pollería.
        if (!esLlamadaInterna(claveInterna) && !esPersonal(authentication)
                && !esDueno(authentication, ordenService.obtener(id))) {
            throw new NoSuchElementException("Orden no encontrada: " + id);
        }

        // El flujo del pedido es obligatorio: quien mueve un pedido por cocina y reparto es el
        // personal de la pollería. Un CLIENTE solo puede cancelar el suyo; si pudiera enviar
        // EN_PREPARACION, LISTO o ENTREGADO se saltaría la operación completa. El orden importa:
        // un pedido ajeno ya respondió 404 arriba, así que aquí no se filtra su existencia.
        if (!esLlamadaInterna(claveInterna) && !esPersonal(authentication)
                && request.getEstado() != OrdenEstado.CANCELADO) {
            throw new AccessDeniedException(
                    "El flujo del pedido lo gestiona la pollería. Del tuyo solo puedes cancelarlo.");
        }

        return ResponseEntity.ok(ordenService.actualizarEstado(id, request, extraerUserId(authentication)));
    }

    private boolean esLlamadaInterna(String claveInterna) {
        return internalApiKey != null && !internalApiKey.isBlank() && claveInterna != null
                && MessageDigest.isEqual(internalApiKey.getBytes(StandardCharsets.UTF_8),
                                         claveInterna.getBytes(StandardCharsets.UTF_8));
    }

    private boolean esPersonal(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> ROLES_PERSONAL.contains(a.getAuthority()));
    }

    private boolean esDueno(Authentication authentication, OrdenResponse orden) {
        Long userId = extraerUserId(authentication);
        return userId > 0 && userId.equals(orden.getClienteId());
    }

    private Long extraerUserId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token) {
            Object creds = token.getCredentials();
            if (creds instanceof Long id) return id;
            if (creds instanceof Integer id) return id.longValue();
        }
        return 0L;
    }
}
