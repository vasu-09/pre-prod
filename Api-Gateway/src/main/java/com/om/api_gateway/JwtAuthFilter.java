package com.om.api_gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return exchange.getPrincipal()
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(JwtAuthenticationToken::getToken)
                .map(jwt -> {
                    String sub = jwt.getSubject();
                    Object userId = jwt.getClaim("userId");
                    return exchange.mutate().request(exchange.getRequest().mutate()
                            .header("X-User-Sub", sub == null ? "" : sub)
                            .header("X-User-Id", userId == null ? "" : String.valueOf(userId))
                            .build()).build();
                })
                .defaultIfEmpty(exchange)
                .flatMap(chain::filter);
    }


    @Override
    public int getOrder() {
        // run after the Spring Security filter chain so that Authentication is available
        return -1;
    }

}
