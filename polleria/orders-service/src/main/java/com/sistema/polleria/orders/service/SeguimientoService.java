package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.dto.OrdenResponse;
import com.sistema.polleria.orders.entity.CodigoSeguimiento;
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
import java.util.Date;
import java.util.List;

/**
 * Seguimiento de pedidos sin iniciar sesión:
 * 1. El cliente escribe su celular y recibe un código de 4 dígitos por WhatsApp.
 * 2. Con el código obtiene un acceso temporal (token) para ver sus pedidos.
 */
@Slf4j
@Service
public class SeguimientoService {

    public static final String TIPO_TOKEN = "seguimiento";

    private static final Duration VIGENCIA_CODIGO = Duration.ofMinutes(5);
    private static final Duration ESPERA_ENTRE_CODIGOS = Duration.ofSeconds(60);
    private static final Duration VIGENCIA_ACCESO = Duration.ofMinutes(30);
    private static final int MAX_INTENTOS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CodigoSeguimientoRepository codigoRepository;
    private final OrdenRepository ordenRepository;
    private final NotificationService notificationService;
    private final SecretKey clave;

    public SeguimientoService(CodigoSeguimientoRepository codigoRepository,
                              OrdenRepository ordenRepository,
                              NotificationService notificationService,
                              @Value("${jwt.secret}") String secreto) {
        this.codigoRepository = codigoRepository;
        this.ordenRepository = ordenRepository;
        this.notificationService = notificationService;
        this.clave = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Envía el código por WhatsApp solo si ese celular tiene pedidos.
     * La respuesta al cliente es la misma en ambos casos, para no revelar qué números son clientes.
     */
    @Transactional
    public void solicitarCodigo(String telefono) {
        String numero = normalizarOFallar(telefono);

        codigoRepository.findTopByTelefonoOrderByCreadoEnDesc(numero).ifPresent(anterior -> {
            if (anterior.getCreadoEn().plus(ESPERA_ENTRE_CODIGOS).isAfter(LocalDateTime.now())) {
                throw new DemasiadasSolicitudesException("Espera un minuto antes de pedir otro código");
            }
        });

        if (!ordenRepository.existsByTelefonoClienteIn(TelefonoUtil.variantes(numero))) {
            log.info("Código de seguimiento solicitado para un celular sin pedidos");
            return;
        }

        codigoRepository.invalidarAnteriores(numero);
        String codigo = String.format("%04d", RANDOM.nextInt(10_000));
        codigoRepository.save(CodigoSeguimiento.builder()
                .telefono(numero)
                .codigo(codigo)
                .expiraEn(LocalDateTime.now().plus(VIGENCIA_CODIGO))
                .build());

        notificationService.enviarCodigoSeguimiento(numero, codigo);
    }

    /** Valida el código y devuelve un acceso temporal para consultar los pedidos de ese celular. */
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public String verificarCodigo(String telefono, String codigo) {
        String numero = normalizarOFallar(telefono);

        CodigoSeguimiento guardado = codigoRepository.findTopByTelefonoAndUsadoFalseOrderByCreadoEnDesc(numero)
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
        String numero;
        try {
            Claims claims = Jwts.parser().verifyWith(clave).build().parseSignedClaims(token).getPayload();
            if (!TIPO_TOKEN.equals(claims.get("tipo", String.class))) {
                throw new IllegalArgumentException();
            }
            numero = claims.getSubject();
        } catch (Exception e) {
            throw new IllegalArgumentException("Tu acceso venció. Verifica tu celular otra vez.");
        }

        return ordenRepository.findTop20ByTelefonoClienteInOrderByCreadoEnDesc(TelefonoUtil.variantes(numero))
                .stream().map(OrdenResponse::from).toList();
    }

    private String normalizarOFallar(String telefono) {
        String numero = TelefonoUtil.normalizar(telefono);
        if (numero == null) {
            throw new IllegalArgumentException("Ingresa un celular válido de 9 dígitos que empiece con 9");
        }
        return numero;
    }
}
