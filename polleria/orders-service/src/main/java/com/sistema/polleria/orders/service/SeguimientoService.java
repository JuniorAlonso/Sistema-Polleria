package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.CodigoSeguimiento;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.exception.DemasiadasSolicitudesException;
import com.sistema.polleria.orders.repository.CodigoSeguimientoRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.util.TelefonoUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.Date;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Seguimiento de pedidos sin iniciar sesión:
 * 1. El cliente escribe su celular y recibe un código de 6 dígitos por WhatsApp.
 * 2. Con el código obtiene un acceso temporal (token) para ver sus pedidos.
 */
@Slf4j
@Service
public class SeguimientoService {

    public static final String TIPO_TOKEN = "seguimiento";

    private static final Duration VIGENCIA_CODIGO = Duration.ofMinutes(5);
    private static final Duration ESPERA_ENTRE_CODIGOS = Duration.ofSeconds(60);
    private static final int MAX_CODIGOS_DIARIOS = 5;
    private static final Duration VIGENCIA_ACCESO = Duration.ofMinutes(30);
    private static final int MAX_INTENTOS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CodigoSeguimientoRepository codigoRepository;
    private final OrdenRepository ordenRepository;
    private final NotificationService notificationService;
    private final OrdenService ordenService;
    private final SecretKey clave;
    private final Map<String, Deque<LocalDateTime>> solicitudesPorTelefono = new ConcurrentHashMap<>();

    public SeguimientoService(CodigoSeguimientoRepository codigoRepository,
                              OrdenRepository ordenRepository,
                              NotificationService notificationService,
                              OrdenService ordenService,
                              @Value("${jwt.secret}") String secreto) {
        this.codigoRepository = codigoRepository;
        this.ordenRepository = ordenRepository;
        this.notificationService = notificationService;
        this.ordenService = ordenService;
        this.clave = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Envía el código por WhatsApp solo si ese celular tiene pedidos.
     * La respuesta y los límites temporales al cliente son idénticos en ambos casos
     * para no revelar qué números pertenecen a clientes.
     */
    @Transactional
    public void solicitarCodigo(String telefono) {
        String numero = normalizarOFallar(telefono);
        LocalDateTime ahora = LocalDateTime.now();

        verificarYRegistrarLimiteSolicitud(numero, ahora);

        if (!ordenRepository.existsByTelefonoClienteIn(TelefonoUtil.variantes(numero))) {
            log.info("Código de seguimiento solicitado para un celular sin pedidos");
            return;
        }

        codigoRepository.invalidarAnteriores(numero);
        String codigo = String.format("%06d", RANDOM.nextInt(1_000_000));
        codigoRepository.save(CodigoSeguimiento.builder()
                .telefono(numero)
                .codigo(codigo)
                .expiraEn(ahora.plus(VIGENCIA_CODIGO))
                .build());

        notificationService.enviarCodigoSeguimiento(numero, codigo);
    }

    private void verificarYRegistrarLimiteSolicitud(String numero, LocalDateTime ahora) {
        LocalDateTime hace24Horas = ahora.minusHours(24);
        codigoRepository.findTopByTelefonoOrderByCreadoEnDesc(numero).ifPresent(anterior -> {
            if (anterior.getCreadoEn() != null && anterior.getCreadoEn().plus(ESPERA_ENTRE_CODIGOS).isAfter(ahora)) {
                throw new DemasiadasSolicitudesException("Espera un minuto antes de pedir otro código");
            }
        });

        long enviosDb24h = codigoRepository.countByTelefonoAndCreadoEnAfter(numero, hace24Horas);
        Deque<LocalDateTime> historial = solicitudesPorTelefono.computeIfAbsent(numero, k -> new ArrayDeque<>());
        synchronized (historial) {
            while (!historial.isEmpty() && historial.peekFirst().isBefore(hace24Horas)) {
                historial.pollFirst();
            }
            LocalDateTime ultimoEnMemoria = historial.peekLast();
            if (ultimoEnMemoria != null && ultimoEnMemoria.plus(ESPERA_ENTRE_CODIGOS).isAfter(ahora)) {
                throw new DemasiadasSolicitudesException("Espera un minuto antes de pedir otro código");
            }
            if (Math.max(enviosDb24h, historial.size()) >= MAX_CODIGOS_DIARIOS) {
                throw new DemasiadasSolicitudesException("Alcanzaste el límite diario de solicitudes de código");
            }
            historial.addLast(ahora);
        }
    }

    /** Valida el código y devuelve un acceso temporal para consultar los pedidos de ese celular. */
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public String verificarCodigo(String telefono, String codigo) {
        String numero = normalizarOFallar(telefono);

        CodigoSeguimiento guardado = codigoRepository.findByTelefonoAndUsadoFalseWithLock(numero)
                .stream()
                .findFirst()
                .or(() -> codigoRepository.findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc(numero))
                .filter(c -> !c.isExpirado() && c.getIntentos() < MAX_INTENTOS)
                .orElseThrow(() -> new IllegalArgumentException("El código venció. Solicita uno nuevo."));

        if (!guardado.getCodigo().equals(codigo == null ? "" : codigo.trim())) {
            guardado.setIntentos(guardado.getIntentos() + 1);
            codigoRepository.save(guardado);
            int restantes = MAX_INTENTOS - guardado.getIntentos();
            throw new IllegalArgumentException(restantes > 0
                    ? "Código incorrecto. Te quedan " + restantes + " intentos."
                    : "Código incorrecto. Solicita uno nuevo.");
        }

        guardado.setUsado(true);
        codigoRepository.save(guardado);

        Date ahora = new Date();
        return Jwts.builder()
                .subject(numero)
                .claim("tipo", TIPO_TOKEN)
                .issuedAt(ahora)
                .expiration(new Date(ahora.getTime() + VIGENCIA_ACCESO.toMillis()))
                .signWith(clave)
                .compact();
    }

    /** Pedidos del celular asociado al acceso temporal. */
    public List<OrdenResponse> listarPedidos(String token) {
        String numero = telefonoDelToken(token);

        return ordenRepository.findTop20ByTelefonoClienteInOrderByCreadoEnDesc(TelefonoUtil.variantes(numero))
                .stream().map(OrdenResponse::from).toList();
    }

    /**
     * S5: el invitado cancela su propio pedido con el celular verificado por WhatsApp. Es la misma
     * identidad que usa {@link #listarPedidos}, no una cuenta: por eso sirve cualquier pedido no
     * terminal escrito con ese celular, aunque se haya hecho sin iniciar sesión.
     *
     * La cancelación delega en {@link OrdenService#actualizarEstado} para que el log, la liberación
     * de mesa y la notificación sean exactamente los mismos que en una cancelación del personal.
     * Un pedido ajeno o inexistente responde 404 (misma convención anti-enumeración que
     * {@code GET /ordenes/{id}}). Un pedido ya {@code ENTREGADO} es rechazado por la máquina de
     * estados (400), no por este método; volver a cancelar uno ya {@code CANCELADO} responde 200 sin
     * cambios, porque la máquina corta cuando el estado destino es el mismo.
     */
    @Transactional
    public OrdenResponse cancelarPedido(Long id, String token) {
        String numero = telefonoDelToken(token);

        Orden orden = ordenRepository.findById(id)
                .filter(o -> numero.equals(TelefonoUtil.canonico(o.getTelefonoCliente())))
                .orElseThrow(() -> new NoSuchElementException("Orden no encontrada: " + id));

        // Same cancellation policy as the authenticated owner: only before the kitchen starts.
        return ordenService.cancelarComoCliente(orden.getId(), null);
    }

    /**
     * Resuelve el celular del acceso temporal. Lo comparten el listado y la cancelación: un token
     * ausente, vencido, alterado o que no sea de seguimiento siempre se rechaza igual (400).
     */
    private String telefonoDelToken(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(clave).build().parseSignedClaims(token).getPayload();
            if (!TIPO_TOKEN.equals(claims.get("tipo", String.class))) {
                throw new IllegalArgumentException();
            }
            return claims.getSubject();
        } catch (Exception e) {
            throw new IllegalArgumentException("Tu acceso venció. Verifica tu celular otra vez.");
        }
    }

    private String normalizarOFallar(String telefono) {
        String numero = TelefonoUtil.normalizar(telefono);
        if (numero == null) {
            throw new IllegalArgumentException("Ingresa un celular válido de 9 dígitos que empiece con 9");
        }
        return numero;
    }
}
