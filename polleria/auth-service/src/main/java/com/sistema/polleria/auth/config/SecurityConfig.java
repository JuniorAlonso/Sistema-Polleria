package com.sistema.polleria.auth.config;

import com.sistema.polleria.auth.filter.IpBlacklistFilter;
import com.sistema.polleria.auth.filter.JwtAuthFilter;
import com.sistema.polleria.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
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
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final IpBlacklistFilter ipBlacklistFilter;
    private final UserRepository userRepository;
    private final Environment environment;

    public SecurityConfig(@Lazy JwtAuthFilter jwtAuthFilter,
            IpBlacklistFilter ipBlacklistFilter,
            UserRepository userRepository,
            Environment environment) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.ipBlacklistFilter = ipBlacklistFilter;
        this.userRepository = userRepository;
        this.environment = environment;
    }

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.cors.allow-loopback:false}")
    private boolean allowLoopback;

    /**
     * Cualquier puerto de loopback: `ng serve` cambia de puerto cuando 4200 está
     * ocupado.
     */
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
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/register", "/auth/login", "/auth/verify-2fa", "/auth/refresh", "/auth/logout").permitAll()
                        .requestMatchers("/auth/sanciones/**").permitAll()
                        // Service-to-service only: the controller itself requires the X-Internal-Key header.
                        .requestMatchers("/auth/internal/**").permitAll()
                        .requestMatchers("/auth/validate").authenticated()
                        .anyRequest().authenticated()
                )
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(contentType -> {})
                )

                .addFilterBefore(ipBlacklistFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        boolean habilitarLoopback = allowLoopback
                || (environment != null && environment.acceptsProfiles(Profiles.of("local", "dev", "test")));
        List<String> origins = origenesPermitidos(allowedOrigins, habilitarLoopback);
        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + username));
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
