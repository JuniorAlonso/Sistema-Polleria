package com.sistema.polleria.feedback.config;

import com.sistema.polleria.feedback.filter.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/feedback/resenias/producto/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/feedback/resenias").permitAll()
                        .requestMatchers(HttpMethod.GET, "/feedback/evidencias/**").permitAll()
                        .anyRequest().authenticated()
                )
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(contentType -> {})
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = origenesPermitidos(allowedOrigins);
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
