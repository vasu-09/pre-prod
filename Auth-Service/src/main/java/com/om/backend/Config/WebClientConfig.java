package com.om.backend.Config;

import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.reactive.function.client.ClientRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@RequiredArgsConstructor
public class WebClientConfig {

    @Autowired
    private SmsProperties props;

    @Bean
    public WebClient smsWebClient() {
        return WebClient.builder()
                .baseUrl(props.getBaseUrl())
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(512 * 1024))
                        .build())
                .build();
    }

    /**
     * Generic WebClient that forwards the caller's JWT to downstream services.
     */
    @Bean
    public WebClient authorizedWebClient(WebClient.Builder builder) {
        return builder
                .filter((request, next) ->
                        ReactiveSecurityContextHolder.getContext()
                                .map(ctx -> ctx.getAuthentication())
                                .cast(JwtAuthenticationToken.class)
                                .map(jwt -> ClientRequest.from(request)
                                        .headers(h -> h.setBearerAuth(jwt.getToken().getTokenValue()))
                                        .build())
                                .defaultIfEmpty(request)
                                .flatMap(next::exchange))
                .build();
    }
}