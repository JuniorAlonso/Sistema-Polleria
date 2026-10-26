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

    /**
     * Orígenes CORS: los configurados más cualquier puerto de loopback. El panel corre en la misma
     * máquina que el servicio y `ng serve` cambia de puerto cuando 4200 está ocupado (o el usuario abre
     * la app por 127.0.0.1 / [::1]). Con la lista exacta el preflight respondía 403 sin
     * `Access-Control-Allow-Origin`, el navegador no enviaba la petición y el login nunca llegaba al
     * backend. Un origen externo sigue sin habilitarse.
     */
    static List<String> origenesPermitidos(String configurados) {
        List<String> origenes = new ArrayList<>(Arrays.stream(configurados.split(","))
                .map(String::trim)
                .map(o -> o.replaceAll("/+$", ""))
                .filter(o -> !o.isEmpty())
                .toList());
        origenes.add(LOOPBACK_LOCALHOST);
        origenes.add(LOOPBACK_IPV4);
        origenes.add(LOOPBACK_IPV6);
        return origenes;
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
                // /pagos/mercadopago/** requiere JWT (CLIENTE/MOZO/ADMIN)
                .requestMatchers("/pagos/webhook/**").permitAll()
                .requestMatchers("/pagos/yape-otp").permitAll()
                .anyRequest().authenticated()
            )
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(contentType -> {})
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
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
        List<String> origins = origenesPermitidos(allowedOrigins);
        cfg.setAllowedOriginPatterns(origins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
