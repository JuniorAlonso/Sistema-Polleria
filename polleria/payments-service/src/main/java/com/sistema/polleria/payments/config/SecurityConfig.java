package com.sistema.polleria.payments.config;

import com.sistema.polleria.payments.filter.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allow-loopback:false}")
    private boolean allowLoopback;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.core.env.Environment environment;

    /**
     * Clave compartida entre microservicios. En despliegue la resuelve la variable de entorno
     * {@code INTERNAL_API_KEY} (relaxed binding) y no tiene valor por defecto: sin ella, el
     * endpoint interno queda cerrado.
     */
    @Value("${internal.api-key:}")
    private String internalApiKey;

    /** Cualquier puerto de loopback: `ng serve` cambia de puerto cuando 4200 está ocupado. */
    static final String LOOPBACK_LOCALHOST = "http://localhost:[*]";
    static final String LOOPBACK_IPV4 = "http://127.0.0.1:[*]";
    static final String LOOPBACK_IPV6 = "http://[::1]:[*]";

    static List<String> origenesPermitidos(String configurados) {
        return origenesPermitidos(configurados, true);
    }

    static List<String> origenesPermitidos(String configurados, boolean incluirLoopback) {
        List<String> origenes = new ArrayList<>(Arrays.stream(configurados.split(","))
                .map(String::trim)
                .map(o -> o.replaceAll("/+$", ""))
                .filter(o -> !o.isEmpty())
                .toList());
        if (incluirLoopback) {
            origenes.add(LOOPBACK_LOCALHOST);
            origenes.add(LOOPBACK_IPV4);
            origenes.add(LOOPBACK_IPV6);
        }
        return origenes;
    }

    private boolean debeIncluirLoopback() {
        if (allowLoopback) {
            return true;
        }
        return environment != null && environment.acceptsProfiles(
                org.springframework.core.env.Profiles.of("local", "dev", "test"));
    }

    @Bean
    @Order(2)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsSource()))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Webhook de pasarela: endpoint público para Mercado Pago
                // Pagos del checkout web de invitados (T3): el servicio valida la orden en orders-service.
                .requestMatchers("/pagos/webhook/**").permitAll()
                .requestMatchers("/pagos/yape-otp").permitAll()
                .requestMatchers(HttpMethod.POST, "/pagos/mercadopago/preferencia").permitAll()
                .requestMatchers(HttpMethod.GET, "/pagos/medios-pago", "/pagos/mercadopago/medios-pago", "/pagos/mercadopago/retorno").permitAll()
                .anyRequest().authenticated()
            )
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(contentType -> {})
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(new ClaveInternaFilter(internalApiKey), JwtAuthFilter.class)
            .build();
    }

    /**
     * Cadena exclusiva del endpoint interno de registro de comprobantes (T6a).
     *
     * El notification-service no tiene JWT de usuario: se autentica con {@code X-Internal-Key}.
     * Esta cadena se separa de la general por dos motivos: exige la autoridad {@code INTERNAL}
     * (no ADMIN, para no dar acceso a todos los pagos ni a los reembolsos) y responde
     * {@code 401} cuando falta la clave o es inválida, en lugar del {@code 403} que usa el resto
     * del servicio. La general no cambia.
     */
    @Bean
    @Order(1)
    public SecurityFilterChain cadenaInterna(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/pagos/comprobante")
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .anyRequest().hasAnyAuthority(ClaveInternaFilter.AUTORIDAD, "ROLE_" + ClaveInternaFilter.AUTORIDAD)
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            )
            .addFilterBefore(new ClaveInternaFilter(internalApiKey),
                    UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        List<String> origins = origenesPermitidos(allowedOrigins, debeIncluirLoopback());
        cfg.setAllowedOriginPatterns(origins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
