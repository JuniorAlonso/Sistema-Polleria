package com.sistema.polleria.orders.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Set<String> ROLES_PERSONAL = Set.of("ROLE_ADMIN", "ROLE_CAJERO", "ROLE_MOZO", "ROLE_COCINA", "ROLE_REPARTIDOR", "ROLE_INTERNAL");

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allow-loopback:false}")
    private boolean allowLoopback;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${internal.api-key:}")
    private String internalApiKey;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        List<String> origins = SecurityConfig.origenesPermitidos(allowedOrigins, allowLoopback);
        registry.addEndpoint("/ws-polleria")
                .setAllowedOriginPatterns(origins.toArray(String[]::new))
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null) {
                    return message;
                }
                StompCommand command = accessor.getCommand();
                if (StompCommand.CONNECT.equals(command)) {
                    Authentication auth = autenticarCabeceras(
                            accessor.getFirstNativeHeader("Authorization"),
                            accessor.getFirstNativeHeader("X-Internal-Key"),
                            jwtSecret,
                            internalApiKey);
                    if (auth == null) {
                        throw new AccessDeniedException("Se requiere autenticación válida para conectar por WebSocket.");
                    }
                    accessor.setUser(auth);
                } else if (StompCommand.SUBSCRIBE.equals(command)) {
                    Authentication auth = accessor.getUser() instanceof Authentication a ? a : null;
                    if (auth == null) {
                        throw new AccessDeniedException("Sesión WebSocket no autenticada.");
                    }
                    String destination = accessor.getDestination();
                    if (requierePersonal(destination) && !tieneRolPersonal(auth)) {
                        throw new AccessDeniedException("Sin permisos para suscribirse a " + destination);
                    }
                }
                return message;
            }
        });
    }

    static Authentication autenticarCabeceras(String authorization, String internalKey, String secret, String expectedInternalKey) {
        if (expectedInternalKey != null && !expectedInternalKey.isBlank() && internalKey != null
                && MessageDigest.isEqual(expectedInternalKey.getBytes(StandardCharsets.UTF_8), internalKey.getBytes(StandardCharsets.UTF_8))) {
            return new UsernamePasswordAuthenticationToken("internal-service", null, List.of(new SimpleGrantedAuthority("ROLE_INTERNAL")));
        }
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        String token = authorization.substring(7).trim();
        if (token.isEmpty()) {
            return null;
        }
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if ("seguimiento".equals(claims.get("tipo", String.class))) {
                return null;
            }
            String role = claims.get("role", String.class);
            List<SimpleGrantedAuthority> authorities = role != null
                    ? List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    : List.of();
            return new UsernamePasswordAuthenticationToken(claims.getSubject(), claims.get("userId"), authorities);
        } catch (Exception e) {
            return null;
        }
    }

    static boolean requierePersonal(String destination) {
        return destination != null && (destination.startsWith("/topic/cocina") || destination.startsWith("/topic/salon"));
    }

    static boolean tieneRolPersonal(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a -> ROLES_PERSONAL.contains(a.getAuthority()));
    }
}
