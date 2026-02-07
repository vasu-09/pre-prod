package com.om.Real_Time_Communication.config;

import feign.RequestInterceptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;

/**
 * Propagates the current JWT to outgoing HTTP clients so downstream
 * services receive the same Authorization header.
 */
@Configuration
public class JwtPropagationConfig {

    /**
     * Feign interceptor that forwards the Bearer token from the current
     * {@link SecurityContextHolder} to downstream services.
     */
    @Bean
    public RequestInterceptor bearerTokenForwarder() {
        return template -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                String token = jwtAuth.getToken().getTokenValue();
                template.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            }
        };
    }

    /**
     * RestTemplate with an interceptor that adds the Bearer token from the
     * security context.
     */
    @Bean
    public RestTemplate restTemplate() {
        RestTemplate rt = new RestTemplate();
        rt.getInterceptors().add((request, body, execution) -> {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                request.getHeaders().setBearerAuth(jwtAuth.getToken().getTokenValue());
            }
            return execution.execute(request, body);
        });
        return rt;
    }

    /**
     * WebClient that reads the JWT from the Reactor security context and
     * forwards it as an Authorization header.
     */
    @Bean
    public WebClient webClient(WebClient.Builder builder) {
        return builder
                .filter((request, next) ->
                        ReactiveSecurityContextHolder.getContext()
                                .map(sc -> sc.getAuthentication())
                                .cast(JwtAuthenticationToken.class)
                                .map(jwtAuth -> ClientRequest.from(request)
                                        .headers(h -> h.setBearerAuth(jwtAuth.getToken().getTokenValue()))
                                        .build())
                                .defaultIfEmpty(request)
                                .flatMap(next::exchange)
                )
                .build();
    }
}