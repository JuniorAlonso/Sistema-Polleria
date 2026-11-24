package com.sistema.polleria.facturacion.config;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
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

import java.nio.charset.StandardCharsets;
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

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) ->
                                escribirJsonError(res, HttpServletResponse.SC_UNAUTHORIZED, "Autenticación requerida"))
                        .accessDeniedHandler((req, res, e) ->
                                escribirJsonError(res, HttpServletResponse.SC_FORBIDDEN,
                                        "Solo ADMIN o CAJERO pueden usar la facturación electrónica"))
                )
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(contentType -> {})
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    private static void escribirJsonError(HttpServletResponse res, int status, String mensaje)
            throws java.io.IOException {
        res.setStatus(status);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"error\":\"" + mensaje.replace("\"", "\\\"") + "\"}");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = origenesPermitidos(allowedOrigins, allowLoopback);
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
