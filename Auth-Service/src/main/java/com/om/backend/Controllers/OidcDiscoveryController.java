package com.om.backend.Controllers;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import jakarta.servlet.http.HttpServletResponse;

@RestController
public class OidcDiscoveryController {

    @Value("${app.issuer}")
    private String issuer;

    @GetMapping(value = "/.well-known/openid-configuration", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> openidConfiguration(HttpServletResponse resp) {
        // cache for a bit (optional)
        resp.setHeader("Cache-Control",
                CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic().getHeaderValue());

        // build minimal OIDC metadata
        Map<String, Object> meta = new HashMap<>();
        meta.put("issuer", issuer);
        meta.put("jwks_uri", issuer + "/.well-known/jwks.json");   // you already expose this
        // Optional but nice to have:
        meta.put("id_token_signing_alg_values_supported", new String[] {"RS256"});
        meta.put("subject_types_supported", new String[] {"public"});

        // If you don’t have these endpoints, omit them. Spring Resource Server doesn’t require them.
        // meta.put("authorization_endpoint", issuer + "/oauth2/authorize");
        // meta.put("token_endpoint", issuer + "/oauth2/token");

        return meta;
    }
}