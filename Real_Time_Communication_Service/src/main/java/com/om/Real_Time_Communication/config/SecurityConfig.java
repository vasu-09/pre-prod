package com.om.Real_Time_Communication.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Basic security configuration that exposes the JWKS endpoint publicly while
 * securing all other endpoints as an OAuth2 resource server.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        // Spring Security's bearer token filter runs before request matching and will
        // reject requests that contain an Authorization header if the JWT cannot be
        // validated. This is problematic for WebSocket handshakes because the token
        // is validated later in {@link JwtHandshakeInterceptor}.  To prevent the
        // resource server from short–circuiting the handshake we use a custom
        // BearerTokenResolver that skips token resolution for the WebSocket endpoint.

        DefaultBearerTokenResolver resolver = new DefaultBearerTokenResolver();
        BearerTokenResolver skippingResolver = request -> {
            String uri = request.getRequestURI();
            if (uri != null && uri.startsWith("/ws")) {
                // Let JwtHandshakeInterceptor handle authentication for WebSockets
                return null;
            }
            return resolver.resolve(request);
        };
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/.well-known/jwks.json", "/actuator/health", "/actuator/health/**", "/actuator/info", "/",  "/ws", "/ws/**", "/rtc/ws", "/rtc/ws/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .bearerTokenResolver(skippingResolver)
                        .jwt(jwt -> jwt.decoder(jwtDecoder))
                );

        return http.build();
    }

    /**
     * Defines the JwtDecoder using the issuer and JWK set URI from
     * {@link RtcJwtConfig}.
     */
    @Bean
    public JwtDecoder jwtDecoder(RtcJwtConfig cfg) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(cfg.getJwksUri()).build();
        OAuth2TokenValidator<Jwt> validator = JwtValidators.createDefaultWithIssuer(cfg.getIssuer());
        decoder.setJwtValidator(validator);
        return decoder;
    }
}
