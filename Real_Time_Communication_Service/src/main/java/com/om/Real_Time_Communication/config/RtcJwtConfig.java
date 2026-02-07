package com.om.Real_Time_Communication.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

@Configuration
@ConfigurationProperties(prefix = "jwt")
public class RtcJwtConfig {
    /** The expected issuer claim. May be discovered from the OIDC metadata. */
    private String issuer;

    /** Direct JWKS URI. If not provided, resolved from issuerUri/issuer. */
    private String jwksUri;

    /** Optional OIDC metadata endpoint (e.g. https://idp/.well-known/openid-configuration). */
    private String issuerUri;

    private String audience;

    private final WebClient webClient = WebClient.builder().build();
    public RtcJwtConfig() {
    }



    public RtcJwtConfig(String issuer, String jwksUri, String issuerUri, String audience) {
        this.issuer = issuer;
        this.jwksUri = jwksUri;
        this.issuerUri = issuerUri;
        this.audience = audience;
    }

    /**
     * Resolve JWKS URI from the configured issuer or issuerUri if necessary.
     */
    public String getJwksUri() {
        if ((jwksUri == null || jwksUri.isBlank()) &&
                ((issuer != null && !issuer.isBlank()) || (issuerUri != null && !issuerUri.isBlank()))) {
            Map<?, ?> meta = fetchOidcMetadata();
            Object uri = meta.get("jwks_uri");
            if (uri != null) {
                jwksUri = uri.toString();
            }
            if (issuer == null || issuer.isBlank()) {
                Object iss = meta.get("issuer");
                if (iss != null) {
                    issuer = iss.toString();
                }
            }
        }
        return jwksUri;
    }


    public String getIssuer() {

        return issuer;
    }
    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public void setJwksUri(String jwksUri) {
        this.jwksUri = jwksUri;
    }

    public void setIssuerUri(String issuerUri) {
        this.issuerUri = issuerUri;
    }


    @PostConstruct
    public void validate() {
        if ((jwksUri == null || jwksUri.isBlank()) &&
                (issuer == null || issuer.isBlank()) &&
                (issuerUri == null || issuerUri.isBlank())) {
            throw new IllegalStateException(
                    "Either jwt.jwks-uri or jwt.issuer / jwt.issuer-uri must be configured");
        }
    }

    public String getAudience() {
        return audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    private Map<?, ?> fetchOidcMetadata() {
        String metadataUrl;
        if (issuerUri != null && !issuerUri.isBlank()) {
            metadataUrl = issuerUri;
        } else {
            String base = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
            metadataUrl = base + "/.well-known/openid-configuration";
        }

        Map<?, ?> meta = webClient.get().uri(metadataUrl)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(3))
                .block();
        if (meta == null) {
            throw new IllegalStateException("Failed to load OIDC metadata from " + metadataUrl);
        }
        return meta;
    }
}