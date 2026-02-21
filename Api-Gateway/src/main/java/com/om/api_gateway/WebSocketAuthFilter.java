package com.om.api_gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


/**
 * Extracts a bearer token from the {@code Sec-WebSocket-Protocol} header and forwards it
 * as a normal {@code Authorization: Bearer <token>} header. The custom subprotocol value
 * is removed so that only genuine WebSocket subprotocols (e.g. STOMP versions) remain.
 */
@Component
public class WebSocketAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(WebSocketAuthFilter.class);

    private static final String WS_PROTOCOL_HEADER = "Sec-WebSocket-Protocol";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        boolean hasUpgradeHeader = "websocket".equalsIgnoreCase(request.getHeaders().getUpgrade());
        boolean hasWsKey = request.getHeaders().containsKey("Sec-WebSocket-Key");
        boolean hasUpgradeConnection = request.getHeaders().getOrEmpty(HttpHeaders.CONNECTION).stream()
                .anyMatch(v -> v.toLowerCase().contains("upgrade"));
        boolean isWebSocketUpgrade = hasUpgradeHeader || (hasWsKey && hasUpgradeConnection);
        boolean isWebSocketPath = request.getURI().getPath() != null &&
                (request.getURI().getPath().startsWith("/ws") || request.getURI().getPath().startsWith("/rtc/ws"));
        boolean inspectWsProtocols = isWebSocketUpgrade || isWebSocketPath;



        List<String> protocols = new ArrayList<>();
        List<String> sanitizedProtocols = new ArrayList<>();
        if (inspectWsProtocols) {
            for (String header : request.getHeaders().getOrEmpty(WS_PROTOCOL_HEADER)) {
                for (String part : header.split(",")) {
                    String trimmed = part.trim();
                    if (!trimmed.isBlank()) {
                        protocols.add(trimmed);
                    }
                }
            }
            log.info("[GATEWAY][WS-FILTER] Sec-WebSocket-Protocol present={}", !protocols.isEmpty());
        }


        String token = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        String tokenSource = null;
        if (token != null && token.regionMatches(true, 0, "bearer ", 0, 7)) {
            tokenSource = "Authorization header";
            token = token.substring(7).trim();
        }
        if (inspectWsProtocols) {
            for (int i = 0; i < protocols.size(); i++) {
                String p = protocols.get(i);
                if (p.regionMatches(true, 0, "bearer ", 0, 7)) {
                    tokenSource = "Sec-WebSocket-Protocol (single)";
                    token = p.substring(7).trim();
                    log.info("[GATEWAY][WS-FILTER] Found bearer token in subprotocol (single)");
                    continue; // drop token from forwarded subprotocols
                }
                if (p.equalsIgnoreCase("bearer") && i + 1 < protocols.size()) {
                    tokenSource = "Sec-WebSocket-Protocol (pair)";
                    token = protocols.get(++i);
                    log.info("[GATEWAY][WS-FILTER] Found bearer token in subprotocol (pair)");
                    continue;
                }
                sanitizedProtocols.add(p);
            }
        }

        if (token == null || token.isBlank()) {
            token = request.getQueryParams().getFirst("access_token");
            if (token != null && !token.isBlank()) {
                tokenSource = "access_token query param";
                log.info("[GATEWAY][WS-FILTER] Found token in access_token query param");
            }
        }
        if (token == null || token.isBlank()) {
            token = request.getQueryParams().getFirst("token");
            if (token != null && !token.isBlank()) {
                tokenSource = "token query param";
                log.info("[GATEWAY][WS-FILTER] Found token in token query param");
            }
        }

        URI sanitizedUri = request.getURI();
        if (token != null && !token.isBlank()) {
            sanitizedUri = UriComponentsBuilder.fromUri(sanitizedUri)
                    .replaceQueryParam("access_token")
                    .replaceQueryParam("token")
                    .build(true)
                    .toUri();
        }

        ServerHttpRequest.Builder mutated = request.mutate().uri(sanitizedUri);
        if (token != null) {
            token = token.trim();
        }
        if (token != null && !token.isBlank()) {
            mutated.header(HttpHeaders.AUTHORIZATION, token.regionMatches(true, 0, "bearer ", 0, 7)
                    ? token
                    : "Bearer " + token);
        }
        if (inspectWsProtocols) {
            if (!sanitizedProtocols.isEmpty()) {
                mutated.headers(h -> h.set(WS_PROTOCOL_HEADER, String.join(",", sanitizedProtocols)));
            } else {
                mutated.headers(h -> h.remove(WS_PROTOCOL_HEADER));
            }
        }
        if (inspectWsProtocols) {
            if (token == null || token.isBlank()) {
                log.info("[GATEWAY][WS-FILTER] No token found for /ws request" +
                        (protocols.isEmpty() ? "" : "; forwarding subprotocols=" + String.join(",", protocols)));
            } else if (tokenSource != null) {
                log.info("[GATEWAY][WS-FILTER] Using token from " + tokenSource);
            }
        }
        return chain.filter(exchange.mutate().request(mutated.build()).build());
    }

    @Override
    public int getOrder() {
        // run before other gateway filters and websocket routing
        return -200;
    }
}