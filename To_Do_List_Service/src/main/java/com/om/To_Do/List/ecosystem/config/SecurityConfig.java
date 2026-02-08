package com.om.To_Do.List.ecosystem.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
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
        http
                // Disable CSRF for simplicity in this demo service
                .csrf(csrf -> csrf.disable())
                // Permit unauthenticated access to the JWKS endpoint
                .authorizeHttpRequests(auth -> auth
                         .requestMatchers(
                                "/.well-known/jwks.json",
                                "/actuator/health", "/actuator/health/**", "/actuator/info", "/"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                // Enable JWT based authentication for the remaining endpoints
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(jwtDecoder)));
        return http.build();
    }

    /**
     * Explicitly defines the {@link JwtDecoder} so that the application context
     * starts even when the auto-configured decoder is missing. It reads the
     * issuer and JWK set URI from application properties and applies standard
     * issuer validation.
     */
    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:http://auth-service.moc-preprod.svc.cluster.local:8092/.well-known/jwks.json}") String jwkSetUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:http://auth-service.moc-preprod.svc.cluster.local:8092}") String issuer) {

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        OAuth2TokenValidator<Jwt> validator = JwtValidators.createDefaultWithIssuer(issuer);
        decoder.setJwtValidator(validator);
        return decoder;
    }
}
