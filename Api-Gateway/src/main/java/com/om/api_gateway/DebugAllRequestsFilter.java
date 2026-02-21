
package com.om.api_gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class DebugAllRequestsFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(DebugAllRequestsFilter.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var req = exchange.getRequest();
        log.info("[DEBUG-FILTER] {} {}", req.getMethod(), req.getPath().value());
        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        // run very early
        return -200;
    }
}
