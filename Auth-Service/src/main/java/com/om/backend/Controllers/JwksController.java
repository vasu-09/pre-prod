package com.om.backend.Controllers;



import com.om.backend.Config.JwtConfig;
import com.om.backend.Config.RsaKeys;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigInteger;
import java.security.interfaces.RSAPublicKey;
import java.util.*;
import static java.util.Base64.getUrlEncoder;

@RestController
public class JwksController {

    private final RSAPublicKey current;
    private final JwtConfig cfg;

    public JwksController(@Qualifier("jwtCurrentPublicKey") RSAPublicKey current, JwtConfig cfg) {
        this.current = current;
        this.cfg = cfg;
    }

    @GetMapping("/.well-known/jwks.json")
    public Map<String,Object> jwks() {
        List<Map<String,Object>> keys = new ArrayList<>();
        keys.add(jwk(cfg.getKid(), current));

        if (hasRotation()) {
            var prev = RsaKeys.loadPublicPem(cfg.getPreviousPublicPem());
            keys.add(jwk(cfg.getPreviousKid(), prev));
        }
        return Map.of("keys", keys);
    }

    private boolean hasRotation() {
        return cfg.getPreviousKid() != null && !cfg.getPreviousKid().isBlank()
                && cfg.getPreviousPublicPem() != null && !cfg.getPreviousPublicPem().isBlank();
    }

    private static Map<String,Object> jwk(String kid, RSAPublicKey pub) {
        return Map.of(
                "kty", "RSA",
                "use", "sig",
                "alg", "RS256",
                "kid", kid,
                "n", b64u(unsigned(pub.getModulus())),
                "e", b64u(unsigned(pub.getPublicExponent()))
        );
    }

    private static byte[] unsigned(BigInteger bi) {
        byte[] b = bi.toByteArray();
        return (b.length > 1 && b[0] == 0) ? Arrays.copyOfRange(b, 1, b.length) : b;
    }
    private static String b64u(byte[] bytes) {
        return getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}

